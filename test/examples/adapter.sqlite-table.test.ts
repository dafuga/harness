import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { SqliteTableAdapter } from '../../src/adapters/development-tooling/SqliteTableAdapter';

const model = {
	table: 'tasks',
	primaryKey: 'id',
	fields: {
		id: { type: 'number' as const },
		name: { type: 'string' as const },
		status: { type: 'string' as const },
		archived: { type: 'boolean' as const, nullable: true }
	}
};

function makeDatabase(
	row: Record<string, unknown> | null = { id: 17, name: 'Ada', status: 'active', archived: null }
) {
	const calls: Array<{ sql: string; bindings: unknown[] }> = [];
	const db = {
		prepare(sql: string) {
			return {
				all(...bindings: unknown[]) {
					calls.push({ sql, bindings });
					return row ? [row] : [];
				},
				get(...bindings: unknown[]) {
					calls.push({ sql, bindings });
					return row;
				},
				run(...bindings: unknown[]) {
					calls.push({ sql, bindings });
					return { changes: row ? 1 : 0 };
				}
			};
		}
	};
	return { db, calls };
}

test('find returns the row with its configured primary key', () => {
	const { db, calls } = makeDatabase();
	const adapter = new SqliteTableAdapter(db as never, model);
	const id = 17;
	const output = adapter.find<{ id: number; name: string }>(id);
	expect(output).toMatchObject({ id, name: 'Ada' });
	expect(calls[0].bindings).toEqual([id]);
	recordExampleCases(
		{
			unitId: 'adapter.sqlite-table',
			symbol: 'SqliteTableAdapter.find',
			state: 'find-returns-the-row-with-its-configured-primary-key',
			evidence: 'examples-cases',
			file: 'find-returns-the-row-with-its-configured-primary-key.json'
		},
		[{ name: 'task 17 resolves to its row', input: id, output }]
	);
});

test('findBy filters declared fields including null values', () => {
	const { db, calls } = makeDatabase();
	const adapter = new SqliteTableAdapter(db as never, model);
	const fields = { status: 'active', archived: null };
	const output = adapter.findBy<{ id: number; name: string }>(fields);
	expect(output).toEqual([{ id: 17, name: 'Ada', status: 'active', archived: null }]);
	expect(calls[0]).toEqual({
		sql: 'SELECT * FROM "tasks" WHERE "status" = ? AND "archived" IS NULL',
		bindings: ['active']
	});
	recordExampleCases(
		{
			unitId: 'adapter.sqlite-table',
			symbol: 'SqliteTableAdapter.findBy',
			state: 'findby-filters-declared-fields-including-null-values',
			evidence: 'examples-cases',
			file: 'findby-filters-declared-fields-including-null-values.json'
		},
		[{ name: 'active tasks with unset archive flag match', input: fields, output }]
	);
});

test('insert returns the inserted task row', () => {
	const { db, calls } = makeDatabase();
	const adapter = new SqliteTableAdapter(db as never, model);
	const input = { name: 'Ada', status: 'active' };
	const output = adapter.insert<{ id: number; name: string }>(input);
	expect(output).toMatchObject({ id: 17, name: 'Ada' });
	expect(calls[0].sql).toBe('INSERT INTO "tasks" ("name", "status") VALUES (?, ?) RETURNING *');
	recordExampleCases(
		{
			unitId: 'adapter.sqlite-table',
			symbol: 'SqliteTableAdapter.insert',
			state: 'insert-returns-the-inserted-task-row',
			evidence: 'examples-cases',
			file: 'insert-returns-the-inserted-task-row.json'
		},
		[{ name: 'new active task is returned', input, output }]
	);
});

test('update changes values and rejects primary key changes', () => {
	const { db, calls } = makeDatabase();
	const adapter = new SqliteTableAdapter(db as never, model);
	const input = { name: 'Ada Lovelace' };
	const output = adapter.update<{ id: number; name: string }>(17, input);
	expect(output).toMatchObject({ id: 17, name: 'Ada' });
	expect(calls[0]).toEqual({
		sql: 'UPDATE "tasks" SET "name" = ? WHERE "id" = ? RETURNING *',
		bindings: ['Ada Lovelace', 17]
	});
	let error = '';
	try {
		adapter.update(17, { id: 18 });
	} catch (caught) {
		error = (caught as Error).message;
	}
	expect(error).toBe('A SQLite primary key cannot be updated');
	recordExampleCases(
		{
			unitId: 'adapter.sqlite-table',
			symbol: 'SqliteTableAdapter.update',
			state: 'update-changes-values-and-rejects-primary-key-changes',
			evidence: 'examples-cases',
			file: 'update-changes-values-and-rejects-primary-key-changes.json'
		},
		[
			{ name: 'name update returns the mapped task row', input: { id: 17, values: input }, output },
			{ name: 'primary key update is rejected', input: { id: 17, values: { id: 18 } }, error }
		]
	);
});

test('delete reports whether a task row was removed', () => {
	const { db } = makeDatabase();
	const adapter = new SqliteTableAdapter(db as never, model);
	const id = 17;
	const output = adapter.delete(id);
	expect(output).toBe(true);
	recordExampleCases(
		{
			unitId: 'adapter.sqlite-table',
			symbol: 'SqliteTableAdapter.delete',
			state: 'delete-reports-whether-a-task-row-was-removed',
			evidence: 'examples-cases',
			file: 'delete-reports-whether-a-task-row-was-removed.json'
		},
		[{ name: 'deleting task 17 reports a row removed', input: id, output }]
	);
});
