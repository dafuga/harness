import { rm, rmdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fail } from '../../core/development-tooling/errors';
import {
	consoleManifest,
	consoleManifestFile,
	writeConsoleManifest,
	type ConsoleChange,
	type ConsoleFileEntry,
	type ConsoleManifest
} from '../../utils/development-tooling/consoleManifest';
import { ConsoleChangeService } from '../../services/projects-sessions/ConsoleChangeService';

export interface ConsoleUninstallOptions {
	host: string;
	/** Remove generated files the host edited too; what they hold is saved and recorded. */
	update?: boolean;
	/** Leave generated files the host edited in place, as the host's own. */
	keep?: boolean;
}

export interface ConsoleUninstallResult {
	host: string;
	removed: string[];
	/** Files that hold again what the host had there before the install replaced it. */
	restored: string[];
	/** Edited files left in place as the host's own. */
	kept: string[];
	changes: ConsoleChange[];
	/** True when no record is left because nothing of the host was ever changed. */
	clean: boolean;
}

type Outcome = Omit<ConsoleUninstallResult, 'host' | 'clean'> & { entries: ConsoleFileEntry[] };

/**
 * Removes an installed console. Files Harness wrote and nobody changed are deleted with the
 * directories they leave empty, what an install replaced is put back, and a generated file the
 * host edited is removed only on request, after its content was saved and recorded.
 */
export class ConsoleUninstallService {
	async uninstall(options: ConsoleUninstallOptions): Promise<ConsoleUninstallResult> {
		const { host } = options;
		const manifest = await consoleManifest(host);
		const owned = manifest.files.filter((file) => file.owner === 'harness');
		if (owned.length === 0) return fail(`No console is installed in ${host}.`);
		const tracker = new ConsoleChangeService(host, manifest);
		const edited = await this.edited(tracker, owned);
		if (edited.length > 0 && !options.update && !options.keep) refuse(edited);
		const done = await this.remove(tracker, manifest, owned, { edited, keep: options.keep });
		const hosts = manifest.files.filter((file) => file.owner === 'host');
		const files = [...hosts, ...done.entries];
		const changes = [...manifest.changes, ...done.changes];
		const clean = files.length === 0 && changes.length === 0;
		if (clean) await rm(join(host, consoleManifestFile), { force: true });
		else await writeConsoleManifest(host, { schemaVersion: 1, files, changes });
		const { removed, restored, kept } = done;
		return { host, removed, restored, kept, changes: done.changes, clean };
	}

	private async edited(
		tracker: ConsoleChangeService,
		owned: ConsoleFileEntry[]
	): Promise<string[]> {
		const states = await Promise.all(owned.map((file) => tracker.state(file.path, null)));
		return owned.filter((_, at) => states[at].kind === 'conflict').map((file) => file.path);
	}

	private async remove(
		tracker: ConsoleChangeService,
		manifest: ConsoleManifest,
		owned: ConsoleFileEntry[],
		asked: { edited: string[]; keep?: boolean }
	): Promise<Outcome> {
		const done: Outcome = { removed: [], restored: [], kept: [], changes: [], entries: [] };
		for (const { path } of owned) {
			const changed = asked.edited.includes(path);
			if (changed && asked.keep) {
				done.kept.push(path);
				done.entries.push(await tracker.entryFor(path, 'host'));
				continue;
			}
			const reason = 'edited since it was installed';
			if (changed)
				done.changes.push(await tracker.replace(path, null, { action: 'removed', reason }));
			else await tracker.remove(path);
			done.removed.push(path);
			if (replacedByInstall(manifest, path)) await this.putBack(tracker, path, done);
			else await pruned(tracker.host, path);
		}
		return done;
	}

	/** The host's own content returns, and from then on the file is the host's again. */
	private async putBack(tracker: ConsoleChangeService, path: string, done: Outcome): Promise<void> {
		const change = await tracker.restore(path);
		if (!change) return;
		done.restored.push(path);
		done.changes.push(change);
		done.entries.push(await tracker.entryFor(path, 'host'));
	}
}

/** True when the last thing recorded for `path` is that an install replaced the host's file. */
function replacedByInstall(manifest: ConsoleManifest, path: string): boolean {
	const latest = [...manifest.changes].reverse().find((change) => change.path === path);
	return latest?.action === 'replaced' && latest.reason === 'host-owned';
}

/** Removes the directories a deleted file leaves empty, stopping at the first that is not. */
async function pruned(host: string, path: string): Promise<void> {
	let directory = dirname(path);
	while (directory !== '.' && directory !== 'src/routes' && directory !== 'src/lib/server') {
		const gone = await rmdir(join(host, directory)).then(
			() => true,
			() => false
		);
		if (!gone) return;
		directory = dirname(directory);
	}
}

function refuse(edited: string[]): never {
	const counted = edited.length === 1 ? '1 file was' : `${edited.length} files were`;
	return fail(
		[
			`${counted} edited since it was installed:`,
			...edited.map((path) => `  ${path}`),
			"Run again with --update to remove them too; what they hold is saved in the project and recorded. Or with --keep to leave them as the host's own."
		].join('\n')
	);
}
