import { join, resolve } from 'node:path';
import {
	ConsoleInstallService,
	type ConsoleInstallResult
} from '../services/ConsoleInstallService';
import { fail } from '../core/errors';
import {
	ConsoleUninstallService,
	type ConsoleUninstallResult
} from '../services/ConsoleUninstallService';
import { consoleManifestFile, type ConsoleChange } from '../utils/consoleManifest';
import { indexFiles } from '../utils/indexFiles';

export interface ConsoleInstallFlags {
	host: string;
	policy: string;
	policyExport: string;
	base: string;
	data?: string;
	bucket?: string;
	prefix?: string;
	update?: boolean;
	keep?: boolean;
}

/** Installs the console into a SvelteKit host behind that host's own policy. */
export function installConsole(flags: ConsoleInstallFlags): Promise<ConsoleInstallResult> {
	return new ConsoleInstallService().install({
		...flags,
		host: resolve(flags.host),
		...(flags.data ? { data: resolve(flags.data) } : {})
	});
}

export interface ConsoleObjectEntry {
	/** Name of the object in the bucket. */
	key: string;
	/** The file of the index it is uploaded from. */
	file: string;
}

const indexed =
	/^(index\.json|(revisions|sides)\/[0-9a-f]{40}\.json|media\/[0-9a-f]{64}\.[a-z0-9]+)$/;

/**
 * The objects a private bucket must hold for a console installed with --bucket: every file of
 * the index under the prefix, with its path unchanged. The list is what an upload tool takes.
 */
export async function consoleObjects(data: string, prefix = ''): Promise<ConsoleObjectEntry[]> {
	if (prefix && !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(prefix))
		fail('--prefix must be a plain path inside the bucket, such as history.');
	const directory = resolve(data);
	const base = prefix ? `${prefix.replace(/\/+$/, '')}/` : '';
	return (await indexFiles(directory))
		.filter((file) => indexed.test(file.path))
		.map((file) => ({ key: `${base}${file.path}`, file: join(directory, file.path) }));
}

/** Removes an installed console and puts back what the install replaced. */
export function uninstallConsole(
	flags: Pick<ConsoleInstallFlags, 'host' | 'update' | 'keep'>
): Promise<ConsoleUninstallResult> {
	if (flags.update && flags.keep) fail('Choose --update or --keep, not both.');
	return new ConsoleUninstallService().uninstall({ ...flags, host: resolve(flags.host) });
}

export function renderConsoleUninstall(result: ConsoleUninstallResult): string {
	const record = result.clean
		? `Nothing of the host was ever changed, so ${consoleManifestFile} was removed as well.`
		: `${consoleManifestFile} keeps the record of what was changed.`;
	return [
		`Removed the console from ${result.host}: ${result.removed.length} files.`,
		...result.restored.map((path) => `  put back the host's own: ${path}`),
		...result.kept.map((path) => `  left as the host's own: ${path}`),
		...result.changes.filter((change) => change.action === 'removed').map(describe),
		record
	].join('\n');
}

/** Puts back the contents an install replaced; the restore is recorded like any change. */
export function restoreConsoleFile(host: string, path: string): Promise<ConsoleChange> {
	return new ConsoleInstallService().restore(resolve(host), path);
}

function describe(change: ConsoleChange): string {
	const now = change.after ? change.after.sha256.slice(0, 12) : 'nothing';
	return `  ${change.action} ${change.path} (${change.reason}): ${change.before.sha256.slice(0, 12)} -> ${now}, previous contents in ${change.before.saved}`;
}

export function renderConsoleChange(change: ConsoleChange): string {
	return [`Recorded in ${consoleManifestFile}:`, describe(change)].join('\n');
}

function described(result: ConsoleInstallResult): string {
	const { storage, data, bundle } = result;
	if (storage.kind === 'bucket') {
		const where = storage.prefix ? `${storage.binding} under ${storage.prefix}/` : storage.binding;
		const counted = data ? ` (${data.revisions} revisions, ${data.media} media files)` : '';
		return `History is read from the private bucket bound as ${where}; nothing is bundled. Upload the index directory there with its paths unchanged${counted}.`;
	}
	if (!data) return 'No history was bundled; run the command again with --data <index directory>.';
	const size = ((bundle?.compressedBytes ?? 0) / 1024 / 1024).toFixed(2);
	return `Bundled ${data.revisions} revisions and ${data.media} media files as server-only modules, ${size} MiB compressed.`;
}

export function renderConsoleInstall(result: ConsoleInstallResult): string {
	const data = described(result);
	const kept = result.kept.map((path) => `  kept as the host's own: ${path}`);
	const tracked =
		result.changes.length > 0
			? ['Changed files that held other content; review them like any other change:']
			: [];
	return [
		`Installed the console at ${result.base} in ${result.host}.`,
		`Every page, data and media request is decided by ${result.policy}.`,
		data,
		`Wrote ${result.written.length} files, removed ${result.removed.length}; they are listed in ${consoleManifestFile}.`,
		...tracked,
		...result.changes.map(describe),
		...kept,
		...result.warnings.map((warning) => `Warning: ${warning}`)
	].join('\n');
}
