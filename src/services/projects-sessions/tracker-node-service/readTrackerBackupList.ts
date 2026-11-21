// @harness-uid u_gvqtr5mdwv
import { lstatSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const backupNames = new Map([
	[/^tracker-(\d{4}-\d{2}-\d{2})\.db\.gz$/, 'daily'],
	[/^tracker-weekly-(\d{4}-\d{2}-\d{2})\.db\.gz$/, 'weekly'],
	[/^tracker-latest-weekly\.db\.gz$/, 'latest-weekly'],
	[/\.db\.bad$/, 'bad'],
	[/^tracker-pre-restore-.*\.db\.gz$/, 'pre-restore']
]);

/** Report local backup metadata while backup creation remains an external effect. */
export function readTrackerBackupList(dir: string = join(homedir(), 'backups', 'tracker')) {
	const files = missingAsUndefined(() => readdirSync(dir)) ?? [];
	return {
		status: { enabled: false, note: 'backup scheduling is external to native Tracker' },
		files: files
			.flatMap((name) => backupFile(dir, name))
			.sort((left, right) => (right.date ?? right.mtime).localeCompare(left.date ?? left.mtime))
	};
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
		if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
		throw error;
	}
}
