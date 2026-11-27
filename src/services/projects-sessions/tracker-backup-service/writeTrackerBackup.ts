// @harness-uid u_vak6ztnr2f
import { randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync, renameSync, rmSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { openSqlite } from '../../../adapters/development-tooling/openSqlite';
import type { SqliteDatabase } from '../../../core/development-tooling/sqliteTypes';
import { readTrackerBackupFiles } from '../tracker-node-service/readTrackerBackupList';
import { assertTrackerBackupOwner } from './assertTrackerBackupOwner';
import {
	assertTrackerBackupIntegrity,
	copyTrackerBackup,
	gzipTrackerBackup,
	snapshotTrackerDatabase
} from './trackerBackupFiles';

const retention = { daily: 14, weekly: 8 };

/** Write one verified daily snapshot, keep Sunday's as weekly, then rotate this folder only. */
export async function writeTrackerBackup(
	database: SqliteDatabase,
	directory: string,
	date: string
) {
	mkdirSync(directory, { recursive: true, mode: 0o700 });
	chmodSync(directory, 0o700);
	const temporary = join(directory, `.tmp-${randomBytes(4).toString('hex')}.db`);
	const compressed = `${temporary}.gz`;
	try {
		snapshotTrackerDatabase(database, temporary);
		verifySnapshot(temporary, directory, date);
		await gzipTrackerBackup(temporary, compressed);
		const file = `tracker-${date}.db.gz`;
		const path = join(directory, file);
		const sunday = new Date(`${date}T00:00:00Z`).getUTCDay() === 0;
		const weekly = sunday ? `tracker-weekly-${date}.db.gz` : undefined;
		// Keep the lock file in place so all writers lock the same inode. SQLite releases
		// the lock on close or process exit, including when a backup fails.
		const lock = openSqlite(join(directory, '.tracker-backup.lock'));
		try {
			await acquireBackupLock(lock);
			await assertTrackerBackupOwner(temporary, directory, weekly ? [file, weekly] : [file]);
			renameSync(compressed, path);
			if (weekly) copyTrackerBackup(path, join(directory, weekly));
			rotateTrackerBackups(directory);
			return { file, size: statSync(path).size };
		} finally {
			lock.close();
		}
	} finally {
		for (const path of [temporary, compressed]) rmSync(path, { force: true });
	}
}

async function acquireBackupLock(lock: SqliteDatabase): Promise<void> {
	const deadline = performance.now() + 10_000;
	for (;;) {
		try {
			lock.exec('BEGIN IMMEDIATE');
			return;
		} catch (error) {
			if (!isSqliteBusy(error) || performance.now() >= deadline) throw error;
		}
		// Yield so another backup in this process can finish and release its lock.
		await delay(10);
	}
}

function isSqliteBusy(error: unknown): boolean {
	return (
		error instanceof Error &&
		(('code' in error && error.code === 'SQLITE_BUSY') ||
			('errcode' in error && error.errcode === 5))
	);
}

/** A snapshot that fails the check is kept for inspection, and nothing is rotated. */
function verifySnapshot(snapshot: string, directory: string, date: string): void {
	try {
		assertTrackerBackupIntegrity(snapshot);
	} catch (error) {
		renameSync(snapshot, join(directory, `tracker-${date}-${Date.now()}.db.bad`));
		throw error;
	}
}

function rotateTrackerBackups(directory: string): void {
	const files = readTrackerBackupFiles(directory);
	for (const [kind, keep] of Object.entries(retention))
		for (const { name } of files.filter((file) => file.kind === kind).slice(keep))
			unlinkSync(join(directory, name));
}
