import { resolve } from 'node:path';
import {
	ConsoleInstallService,
	type ConsoleInstallResult
} from '../services/ConsoleInstallService';
import { consoleManifestFile, type ConsoleChange } from '../utils/consoleManifest';

export interface ConsoleInstallFlags {
	host: string;
	policy: string;
	policyExport: string;
	base: string;
	data?: string;
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

export function renderConsoleInstall(result: ConsoleInstallResult): string {
	const data = result.data
		? `Bundled ${result.data.revisions} revisions and ${result.data.media} media files as server-only modules.`
		: 'No history was bundled; run the command again with --data <index directory>.';
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
