import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, linkSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openSqlite } from '../../../adapters/development-tooling/openSqlite';
import type { SqliteDatabase } from '../../../core/development-tooling/sqliteTypes';
import { assertTrackerBackupIntegrity, expandTrackerBackup } from './trackerBackupFiles';

// The backup supplies the synced journal. Every other table records what this computer really
// did (runs, deliveries, reminders), which must not roll back and happen again.
const restoredTables = new Set(['items', 'item_notes', 'ops', 'meta']);
type Table = { name: string; sql: string };

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
export async function restoreTrackerBackup(request: { backup: string; live: string; to: string }) {
	const { backup, live, to } = request;
	if (existsSync(to)) throw new TypeError(`restore target already exists: ${to}`);
	if (!existsSync(live)) throw new TypeError(`live database not found: ${live}`);
	const temporary = `${to}.tmp-${randomBytes(4).toString('hex')}`;
	try {
		await expandTrackerBackup(backup, temporary);
		inspectTrackerBackup(temporary);
		const carried = carryOverLocalState(live, temporary);
		const summary = inspectTrackerBackup(temporary);
		linkSync(temporary, to);
		return { ...summary, carried };
	} finally {
		for (const suffix of ['', '-wal', '-shm']) rmSync(temporary + suffix, { force: true });
	}
}

function inspectTrackerBackup(path: string) {
	assertTrackerBackupIntegrity(path);
	const database = openSqlite(path, true);
	try {
		const count = (table: 'items' | 'ops') =>
			(database.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;
		return { items: count('items'), ops: count('ops') };
	} finally {
		database.close();
	}
}

function carryOverLocalState(live: string, restored: string): string[] {
	const database = openSqlite(restored);
	try {
		database.prepare('ATTACH DATABASE ? AS current').run(live);
		database.exec('BEGIN');
		const tables = database
			.prepare(
				"SELECT name, sql FROM current.sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
			)
			.all() as Table[];
		const local = tables.filter(({ name }) => !restoredTables.has(name));
		for (const table of local) copyTable(database, table);
		database.prepare("UPDATE meta SET v = ? WHERE k = 'db_id'").run(randomUUID());
		database.exec('COMMIT');
		database.exec('DETACH DATABASE current');
		// One self-contained file: nothing is left in a WAL when it is moved into place.
		database.exec('PRAGMA journal_mode = DELETE');
		return local.map(({ name }) => name);
	} finally {
		database.close();
	}
}

/** Match columns by name so an older backup's schema still works. */
function copyTable(database: SqliteDatabase, { name, sql }: Table): void {
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
