// @harness-uid u_d6mtahlgx2
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, linkSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openSqlite } from '../../../adapters/development-tooling/openSqlite';
import type { SqliteDatabase } from '../../../core/development-tooling/sqliteTypes';
import type { TrackerBackupTable } from './restoreTrackerBackup.types';
import {
	assertTrackerBackupIntegrity,
	expandTrackerBackup,
	snapshotTrackerDatabase
} from './trackerBackupFiles';

// The backup supplies the synced journal. Every other table records what this computer really
// did (runs, deliveries, reminders), which must not roll back and happen again.
const restoredTables = new Set(['items', 'item_notes', 'ops', 'meta']);

/** Prove a backup expands to an intact Tracker journal, without touching any live file. */
export async function verifyTrackerBackup(backup: string) {
	const scratch = join(tmpdir(), `tracker-verify-${randomBytes(8).toString('hex')}`);
	mkdirSync(scratch, { mode: 0o700 });
	try {
		const copy = join(scratch, 'tracker.db');
		await expandTrackerBackup(backup, copy);
		return inspectTrackerBackup(copy);
	} finally {
		rmSync(scratch, { recursive: true, force: true });
	}
}

/**
 * Build a restored database at a new path. A new database identity makes every spoke
 * send its whole journal again, which recovers changes newer than the backup.
 */
export async function restoreTrackerBackup(request: { backup: string; live?: string; to: string }) {
	const { backup, live, to } = request;
	if (existsSync(to)) throw new TypeError(`restore target already exists: ${to}`);
	if (live && !existsSync(live))
		throw new TypeError(`live database not found: ${live} (see --without-local-state)`);
	const temporary = `${to}.tmp-${randomBytes(4).toString('hex')}`;
	const finished = `${temporary}.done`;
	try {
		await expandTrackerBackup(backup, temporary);
		inspectTrackerBackup(temporary);
		const carried = prepareRestoredCopy(temporary, finished, live);
		const summary = inspectTrackerBackup(finished);
		linkSync(finished, to);
		return { ...summary, carried };
	} finally {
		for (const path of [temporary, finished])
			for (const suffix of ['', '-wal', '-shm']) rmSync(path + suffix, { force: true });
	}
}

function inspectTrackerBackup(path: string) {
	assertTrackerBackupIntegrity(path);
	const database = openSqlite(path);
	try {
		const count = (table: 'items' | 'ops') =>
			(database.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;
		return { items: count('items'), ops: count('ops') };
	} finally {
		database.close();
	}
}

/** With no usable live database, local records stay as they were when the backup was taken. */
function prepareRestoredCopy(working: string, finished: string, live?: string): string[] {
	const database = openSqlite(working);
	try {
		const carried = live ? carryOverLocalState(database, live) : [];
		database.prepare("UPDATE meta SET v = ? WHERE k = 'db_id'").run(randomUUID());
		// A fresh copy is one self-contained file, with nothing left in a WAL.
		snapshotTrackerDatabase(database, finished);
		return carried;
	} finally {
		database.close();
	}
}

function carryOverLocalState(database: SqliteDatabase, live: string): string[] {
	database.prepare('ATTACH DATABASE ? AS current').run(live);
	database.exec('BEGIN');
	const tables = database
		.prepare(
			"SELECT name, sql FROM current.sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
		)
		.all() as TrackerBackupTable[];
	const local = tables.filter(({ name }) => !restoredTables.has(name));
	for (const table of local) copyTable(database, table);
	database.exec('COMMIT');
	database.exec('DETACH DATABASE current');
	return local.map(({ name }) => name);
}

/** Match columns by name so an older backup's schema still works. */
function copyTable(database: SqliteDatabase, { name, sql }: TrackerBackupTable): void {
	const quoted = (value: string) => `"${value.replaceAll('"', '""')}"`;
	const columns = (schema: 'main' | 'current') =>
		(
			database.prepare(`PRAGMA ${schema}.table_info(${quoted(name)})`).all() as { name: string }[]
		).map((column) => column.name);
	if (!columns('main').length) database.exec(sql);
	const present = new Set(columns('main'));
	const shared = columns('current')
		.filter((column) => present.has(column))
		.map(quoted)
		.join(', ');
	database.exec(`DELETE FROM main.${quoted(name)}`);
	database.exec(
		`INSERT INTO main.${quoted(name)}(${shared}) SELECT ${shared} FROM current.${quoted(name)}`
	);
}
