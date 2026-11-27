// @harness-uid u_vak6ztnr2f
import { randomBytes } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { openSqlite } from '../../../adapters/development-tooling/openSqlite';
import { readTrackerBackupFiles } from '../tracker-node-service/readTrackerBackupList';
import { expandTrackerBackup } from './trackerBackupFiles';

/**
 * A backup folder belongs to the database that wrote its newest daily copy. Fail before
 * another database replaces a file there, or adds one that would rotate older copies out.
 */
export async function assertTrackerBackupOwner(
	snapshot: string,
	directory: string,
	targets: string[]
): Promise<void> {
	const files = readTrackerBackupFiles(directory);
	const newest = files.find(({ kind }) => kind === 'daily');
	const replaced = files.filter(({ name }) => targets.includes(name));
	const guarded = new Set([...replaced, ...(newest ? [newest] : [])].map(({ name }) => name));
	if (!guarded.size) return;
	const own = readDatabaseId(snapshot);
	for (const name of guarded) {
		const found = await readBackupDatabaseId(directory, name);
		if (found !== own)
			throw new TypeError(
				`${name} belongs to another database (${found}, this one is ${own}); ` +
					`nothing was replaced or rotated in ${directory}`
			);
	}
}

async function readBackupDatabaseId(directory: string, name: string): Promise<string> {
	const copy = join(directory, `.tmp-${randomBytes(4).toString('hex')}.db`);
	try {
		await expandTrackerBackup(join(directory, name), copy);
		return readDatabaseId(copy);
	} catch (error) {
		const cause = error instanceof Error ? error.message : String(error);
		throw new TypeError(
			`cannot read the database id of ${name} (${cause}); ` +
				`nothing was replaced or rotated in ${directory}`
		);
	} finally {
		for (const suffix of ['', '-wal', '-shm']) rmSync(copy + suffix, { force: true });
	}
}

/** Pass only a private working copy: see assertTrackerBackupIntegrity. */
function readDatabaseId(path: string): string {
	const database = openSqlite(path);
	try {
		const row = database.prepare("SELECT v FROM meta WHERE k = 'db_id'").get() as
			| { v: string }
			| undefined;
		if (!row) throw new TypeError('no database id');
		return row.v;
	} finally {
		database.close();
	}
}
