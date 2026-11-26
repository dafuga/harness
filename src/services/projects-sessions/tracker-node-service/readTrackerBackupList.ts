// @harness-uid u_gvqtr5mdwv
import { lstatSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const backupNames = new Map([
	[/^tracker-(\d{4}-\d{2}-\d{2})\.db\.gz$/, 'daily'],
	[/^tracker-weekly-(\d{4}-\d{2}-\d{2})\.db\.gz$/, 'weekly'],
	[/^tracker-latest-weekly\.db\.gz$/, 'latest-weekly'],
	[/^tracker-\d{8}T\d{4}Z\.db\.gz$/, 'hourly'],
	[/\.db\.bad$/, 'bad'],
	[/^tracker-pre-restore-.*\.db\.gz$/, 'pre-restore']
]);

/** Report local backup metadata, with the hub's own backup status when it takes them. */
export function readTrackerBackupList(
	dir: string = join(homedir(), 'backups', 'tracker'),
	backups?: { status: object; externalDirectory?: string }
) {
	const external = backups?.externalDirectory
		? readTrackerBackupFiles(backups.externalDirectory).filter(({ kind }) => kind === 'hourly')
		: [];
	return {
		status: backups?.status ?? {
			enabled: false,
			note: 'native backups are not enabled on this node'
		},
		files: [...readTrackerBackupFiles(dir), ...external].sort(newestFirst)
	};
}

export function readTrackerBackupFiles(dir: string) {
	const files = missingAsUndefined(() => readdirSync(dir)) ?? [];
	return files.flatMap((name) => backupFile(dir, name)).sort(newestFirst);
}

function newestFirst(
	left: { date: string | null; mtime: string },
	right: { date: string | null; mtime: string }
) {
	return (right.date ?? right.mtime).localeCompare(left.date ?? left.mtime);
}

function backupFile(dir: string, name: string) {
	for (const [pattern, kind] of backupNames) {
		const match = pattern.exec(name);
		if (!match) continue;
		const stat = missingAsUndefined(() => lstatSync(join(dir, name)));
		if (stat?.isFile())
			return [
				{ name, kind, date: match[1] ?? null, size: stat.size, mtime: stat.mtime.toISOString() }
			];
		break;
	}
	return [];
}

function missingAsUndefined<T>(read: () => T): T | undefined {
	try {
		return read();
	} catch (error) {
		const code = error instanceof Error && 'code' in error ? error.code : undefined;
		if (code === 'ENOENT' || code === 'ENOTDIR') return undefined;
		throw error;
	}
}
