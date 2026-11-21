import { createHash } from 'node:crypto';
import type {
	SqliteDatabase,
	SqliteStatement,
	SqliteValue
} from '../../../core/development-tooling/sqliteTypes';
import type { TrackerSnapshotFingerprint } from '../TrackerSnapshotAdapter.types';

function quoteIdentifier(name: string): string {
	return '"' + name.replaceAll('"', '""') + '"';
}

function typedColumn(name: string, index: number): string {
	const column = quoteIdentifier(name);
	// Cast before crossing the driver boundary. JS numbers lose wide integers and JS
	// strings can replace invalid UTF-8 or truncate at a NUL depending on the driver.
	return `typeof(${column}) AS t${index}, CASE typeof(${column})
		WHEN 'integer' THEN CAST(${column} AS TEXT)
		WHEN 'text' THEN CAST(${column} AS BLOB)
		ELSE ${column} END AS v${index}`;
}

function typedValue(type: string, value: SqliteValue): SqliteValue {
	if (value instanceof Uint8Array) return Buffer.from(value).toString('hex');
	if (type === 'real') {
		const bytes = Buffer.alloc(8);
		bytes.writeDoubleBE(value as number);
		return bytes.toString('hex');
	}
	return value;
}

export function fingerprintRows(
	db: SqliteDatabase,
	columns: string[],
	source: string,
	bindings: SqliteValue[] = []
): TrackerSnapshotFingerprint {
	const projection = columns.map(typedColumn).join(', ');
	const statement = db.prepare(`SELECT ${projection} ${source}`) as SqliteStatement & {
		iterate(...values: SqliteValue[]): Iterable<Record<string, SqliteValue>>;
	};
	const rowHashes: string[] = [];
	for (const row of statement.iterate(...bindings)) {
		const cells = columns.map((_, index) => {
			const type = row[`t${index}`] as string;
			return [type, typedValue(type, row[`v${index}`])];
		});
		rowHashes.push(createHash('sha256').update(JSON.stringify(cells)).digest('hex'));
	}
	// Fixed-width row digests give deterministic, duplicate-sensitive ordering for tables
	// without a primary key, without retaining raw rows in memory after each iteration.
	const tableHash = createHash('sha256');
	for (const hash of rowHashes.sort()) tableHash.update(hash, 'hex');
	return { rowCount: rowHashes.length, sha256: tableHash.digest('hex') };
}

export function fingerprintTable(
	db: SqliteDatabase,
	table: string,
	filter: { sql: string; bindings: SqliteValue[] } = { sql: '', bindings: [] }
): TrackerSnapshotFingerprint {
	const columns = db
		.prepare("SELECT name FROM pragma_table_xinfo(?, 'main') WHERE hidden <> 1 ORDER BY cid")
		.all(table) as { name: string }[];
	return fingerprintRows(
		db,
		columns.map(({ name }) => name),
		`FROM main.${quoteIdentifier(table)} ${filter.sql}`,
		filter.bindings
	);
}
