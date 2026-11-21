// @harness-uid u_earfvkmyr2
import { createHash } from 'node:crypto';
import { realpathSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type { SqliteDatabase } from '../../core/development-tooling/sqliteTypes';
import { openSqlite } from '../development-tooling/openSqlite';
import type {
	TrackerSnapshotComparison,
	TrackerSnapshotFingerprint,
	TrackerSnapshotSummary,
	TrackerSnapshotSyncOptions
} from './TrackerSnapshotAdapter.types';
import { fingerprintRows, fingerprintTable } from './tracker-snapshot-adapter/snapshotFingerprint';
import { fingerprintPendingPush } from './tracker-snapshot-adapter/snapshotPendingPush';

function standaloneFile(path: string): string {
	let file: string;
	let hasJournal: boolean;
	try {
		file = realpathSync(path);
		const info = statSync(file);
		if (!info.isFile() || info.size < 100) throw new Error('Expected a SQLite file');
		hasJournal = ['-wal', '-journal'].some(
			(suffix) => (statSync(file + suffix, { throwIfNoEntry: false })?.size ?? 0) > 0
		);
	} catch {
		throw new Error('Unable to read SQLite snapshot');
	}
	if (hasJournal) throw new Error('SQLite snapshot has a nonempty WAL or rollback journal');
	// The inputs must be quiesced copies. Immutable mode also keeps SQLite from
	// creating sidecars when reading a checkpoint whose header still declares WAL.
	return pathToFileURL(file).href + '?immutable=1';
}

function summarize(db: SqliteDatabase, sync?: TrackerSnapshotSyncOptions): TrackerSnapshotSummary {
	const tables = db
		.prepare(
			`
		SELECT name, type FROM pragma_table_list
		WHERE schema = 'main' AND type != 'view' AND name != 'sqlite_schema'
		ORDER BY name COLLATE BINARY
	`
		)
		.all() as { name: string; type: string }[];
	if (tables.some(({ type }) => type !== 'table')) throw new Error('Unsupported SQLite table type');
	const check = db.prepare('PRAGMA main.integrity_check').all() as { integrity_check: string }[];
	if (check.length !== 1 || check[0].integrity_check !== 'ok')
		throw new Error('Integrity check failed');

	return {
		schema: fingerprintSchema(db),
		tables: tables.map(({ name }) => ({ name, ...fingerprintTable(db, name) })),
		...(sync ? { pendingPush: fingerprintPendingPush(db, sync) } : {})
	};
}

function fingerprintSchema(db: SqliteDatabase): TrackerSnapshotFingerprint {
	const definitions = fingerprintRows(
		db,
		['type', 'name', 'tbl_name', 'sql'],
		'FROM main.sqlite_schema'
	);
	const header = fingerprintRows(
		db,
		['user_version', 'application_id', 'encoding'],
		'FROM pragma_user_version, pragma_application_id, pragma_encoding'
	);
	const sha256 = createHash('sha256')
		.update(definitions.sha256 + header.sha256, 'hex')
		.digest('hex');
	return { rowCount: definitions.rowCount, sha256 };
}

function differs(before?: TrackerSnapshotFingerprint, after?: TrackerSnapshotFingerprint): boolean {
	return before?.rowCount !== after?.rowCount || before?.sha256 !== after?.sha256;
}

function compareTables(before: TrackerSnapshotSummary, after: TrackerSnapshotSummary): string[] {
	const oldTables = new Map(before.tables.map((table) => [table.name, table]));
	const newTables = new Map(after.tables.map((table) => [table.name, table]));
	return [...new Set([...oldTables.keys(), ...newTables.keys()])]
		.sort()
		.filter((name) => differs(oldTables.get(name), newTables.get(name)));
}

/** Fingerprint two stable SQLite backup copies without opening them for writes. */
export class TrackerSnapshotAdapter {
	/** Returns counts and hashes only, with table names as labels. */
	read(path: string, sync?: TrackerSnapshotSyncOptions): TrackerSnapshotSummary {
		const file = standaloneFile(path);
		try {
			const db = openSqlite(file, true);
			try {
				db.exec('PRAGMA trusted_schema = OFF; PRAGMA query_only = ON');
				return summarize(db, sync);
			} finally {
				db.close();
			}
		} catch {
			// SQLite diagnostics can contain private schema or row content.
			throw new Error('Unable to read SQLite snapshot');
		}
	}

	/** Compares schema, every table, and optionally the pending operation sets for configured links. */
	compare(
		beforePath: string,
		afterPath: string,
		sync?: TrackerSnapshotSyncOptions
	): TrackerSnapshotComparison {
		const before = this.read(beforePath, sync);
		const after = this.read(afterPath, sync);
		const schemaChanged = differs(before.schema, after.schema);
		const changedTables = compareTables(before, after);
		const changedPendingLinks = (['hub', 'peer'] as const).filter((link) =>
			differs(before.pendingPush?.[link], after.pendingPush?.[link])
		);
		return {
			matches: !schemaChanged && !changedTables.length && !changedPendingLinks.length,
			schemaChanged,
			changedTables,
			changedPendingLinks,
			before,
			after
		};
	}
}
