// @harness-uid u_e7x5dhawh4
import type { SqliteDatabase } from '../../../core/development-tooling/sqliteTypes';
import type { QueueTable } from './queueTable.types';
import { validateQueueTable } from './legacyQueueSchema';

export function validateTable<Row, Stored>(
	database: SqliteDatabase,
	table: QueueTable<Row, Stored>
): void {
	const key = table.key ?? 'key';
	validateQueueTable(database, table.name, key, [key, ...table.columns]);
}

export function readQueueTable<Row, Stored>(
	database: SqliteDatabase,
	table: QueueTable<Row, Stored>
): Map<string, Row> {
	const { name, key = 'key', columns } = table;
	const selected = database
		.prepare(`SELECT ${key} AS queue_key, ${columns.join(', ')} FROM ${name} ORDER BY rowid`)
		.all() as (Stored & { queue_key: string })[];
	return new Map(selected.map((row) => [row.queue_key, table.read(row)]));
}

export function writeQueueTable<Row, Stored>(
	database: SqliteDatabase,
	table: QueueTable<Row, Stored>,
	previous: ReadonlyMap<string, Row>,
	draft: ReadonlyMap<string, Row>
): void {
	const { name, key = 'key', columns, values } = table;
	for (const id of previous.keys()) {
		if (!draft.has(id)) database.prepare(`DELETE FROM ${name} WHERE ${key} = ?`).run(id);
	}
	for (const [id, row] of draft) {
		const before = previous.get(id);
		const next = values(row);
		if (before === undefined) {
			const slots = Array.from({ length: next.length + 1 }, () => '?');
			database
				.prepare(`INSERT INTO ${name} (${key}, ${columns.join(', ')}) VALUES (${slots.join(', ')})`)
				.run(id, ...next);
		} else {
			const prior = values(before);
			const changed = columns.flatMap((column, index) =>
				prior[index] === next[index] ? [] : [{ column, value: next[index] }]
			);
			if (changed.length)
				database
					.prepare(
						`UPDATE ${name} SET ${changed.map(({ column }) => `${column} = ?`).join(', ')} WHERE ${key} = ?`
					)
					.run(...changed.map(({ value }) => value), id);
		}
	}
}
