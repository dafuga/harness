import {
	chmodSync,
	copyFileSync,
	createReadStream,
	createWriteStream,
	renameSync,
	rmSync
} from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createGunzip, createGzip } from 'node:zlib';
import { openSqlite } from '../../../adapters/development-tooling/openSqlite';
import type { SqliteDatabase } from '../../../core/development-tooling/sqliteTypes';

/** Fail unless SQLite reads the whole file and reports it as intact. */
export function assertTrackerBackupIntegrity(path: string): void {
	const database = openSqlite(path, true);
	try {
		const rows = database.prepare('PRAGMA integrity_check').all() as object[];
		const messages = rows.map((row) => String(Object.values(row)[0]));
		if (messages.join() !== 'ok')
			throw new TypeError(`integrity_check: ${messages.slice(0, 3).join('; ')}`);
	} finally {
		database.close();
	}
}

/** VACUUM INTO is a consistent online copy, safe with a WAL and a running service. */
export function snapshotTrackerDatabase(database: SqliteDatabase, path: string): void {
	database.prepare('VACUUM INTO ?').run(path);
	chmodSync(path, 0o600);
}

export async function gzipTrackerBackup(from: string, to: string): Promise<void> {
	await pipeline(createReadStream(from), createGzip(), createWriteStream(to, { mode: 0o600 }));
}

/** Expand a .db.gz backup, or copy an uncompressed one, into a new private file. */
export async function expandTrackerBackup(from: string, to: string): Promise<void> {
	if (!from.endsWith('.gz')) {
		copyFileSync(from, to);
		chmodSync(to, 0o600);
		return;
	}
	await pipeline(createReadStream(from), createGunzip(), createWriteStream(to, { mode: 0o600 }));
}

export function copyTrackerBackup(from: string, to: string): void {
	const temporary = `${to}.tmp`;
	try {
		copyFileSync(from, temporary);
		chmodSync(temporary, 0o600);
		renameSync(temporary, to);
	} finally {
		rmSync(temporary, { force: true });
	}
}
