// @harness-uid u_r7qgepnoax
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
	restoreTrackerBackup,
	verifyTrackerBackup
} from '../../../services/projects-sessions/tracker-backup-service/restoreTrackerBackup';
import type { TrackerBackupResult } from '../../../services/projects-sessions/TrackerBackupService.types';
import type { TrackerNodeConfig } from '../../../services/projects-sessions/tracker-node-service/trackerNodeConfig.types';

const usage =
	'usage: tracker backup verify <file> | restore <file> --to <new path> [--without-local-state]';

/** Verify and restore run in this process: they must work when the service cannot start. */
export function isLocalBackupCommand([command, mode]: string[]): boolean {
	return command === 'backup' && (mode === 'verify' || mode === 'restore');
}

export async function runLocalTrackerBackup(
	args: string[],
	config: TrackerNodeConfig
): Promise<number> {
	try {
		const { values, positionals } = parseArgs({
			args,
			allowPositionals: true,
			options: { to: { type: 'string' }, 'without-local-state': { type: 'boolean' } }
		});
		const [mode, name, ...rest] = positionals;
		if (!name || rest.length || (mode === 'restore') !== Boolean(values.to))
			throw new TypeError(usage);
		const backup = findBackup(name, config);
		if (!values.to) {
			const { items, ops } = await verifyTrackerBackup(backup);
			console.log(`${backup}: integrity ok, ${items} items, ${ops} ops`);
			return 0;
		}
		const to = resolve(values.to);
		const live = values['without-local-state'] ? undefined : config.database;
		const { items, ops } = await restoreTrackerBackup({ backup, live, to });
		console.log(restoreSteps(config, to, `${items} items, ${ops} ops`));
		return 0;
	} catch (error) {
		console.error(`tracker: ${error instanceof Error ? error.message : 'backup command failed'}`);
		return 1;
	}
}

export function renderTrackerBackup(result: TrackerBackupResult, json: boolean): number {
	if (json) console.log(JSON.stringify(result, null, 2));
	else if (result.ok) console.log(`backup ok: ${result.file} (${result.size} bytes)`);
	else console.error(`tracker: backup failed: ${result.error}`);
	return result.ok ? 0 : 1;
}

function backupDirectories({ backupDirectory }: TrackerNodeConfig): [string, string] {
	const shared = join(homedir(), 'backups', 'tracker');
	return [backupDirectory ?? join(shared, 'native'), shared];
}

function findBackup(name: string, config: TrackerNodeConfig): string {
	const directories = backupDirectories(config);
	const candidates = [resolve(name), ...directories.map((dir) => join(dir, basename(name)))];
	const found = candidates.find((path) => existsSync(path));
	if (!found) throw new TypeError(`no such backup file: ${name}`);
	return found;
}

function restoreSteps(config: TrackerNodeConfig, to: string, summary: string): string {
	const live = config.database;
	const [native] = backupDirectories(config);
	return [
		`restored copy ready: ${to} (integrity ok, ${summary}); the live database is unchanged`,
		'To use it:',
		'  1. Stop the Tracker service and confirm it cannot restart by itself.',
		'  2. Run this restore again to a new path, so run and delivery records are current.',
		`  3. Move ${live}, ${live}-wal and ${live}-shm aside; keep them.`,
		`  4. Move the restored file to ${live} (mode 600) and start the service.`,
		`  5. Move the tracker-*.db.gz files in ${native} into a subfolder, keeping them: the`,
		'     new database identity never replaces or rotates backups taken under the old one.',
		'Each spoke sees the new database identity and sends its whole journal again.'
	].join('\n');
}
