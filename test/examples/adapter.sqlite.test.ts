import { createRequire } from 'node:module';
import { join } from 'node:path';
import { test } from 'vitest';
import {
	createSqliteAdapter,
	SqliteAdapter
} from '../../src/adapters/development-tooling/SqliteAdapter';
import type { SqliteDatabase, SqliteModel } from '../../src/core/development-tooling/sqliteTypes';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

const sqlite = createRequire(import.meta.url)(process.versions.bun ? 'bun:sqlite' : 'node:sqlite');
const DatabaseDriver = process.versions.bun ? sqlite.Database : sqlite.DatabaseSync;

const taskModels: readonly SqliteModel[] = [
	{
		table: 'tasks',
		fields: {
			id: { type: 'number' },
			name: { type: 'string' },
			active: { type: 'boolean' },
			metadata: { type: 'json' },
			updatedAt: { type: 'string', default: 'timestamp' }
		}
	}
];

type Task = { id: number; name: string; updatedAt: string; [key: string]: unknown };

async function withDatabase(use: (db: SqliteDatabase) => Promise<void> | void): Promise<void> {
	await withTempDir('sqlite-adapter-examples-', async (directory) => {
		const db = new DatabaseDriver(join(directory, 'tasks.sqlite')) as SqliteDatabase;
		try {
			await use(db);
		} finally {
			db.close();
		}
	});
}

function adapterFor(db: SqliteDatabase): SqliteAdapter {
	const adapter = new SqliteAdapter(db, taskModels);
	adapter.createTables();
	return adapter;
}

function insertTask(adapter: SqliteAdapter, name = 'Ada', tier = 'free'): Task {
	return adapter.insert<Task>('tasks', { name, active: true, metadata: { tier } });
}

function record(
	symbol: string,
	state: string,
	cases: Parameters<typeof recordExampleCases>[1]
): void {
	recordExampleCases(
		{ unitId: 'adapter.sqlite', symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
}

test('Creates a task row with declared field mappings', async () => {
	await withDatabase(async (db) => {
		const adapter = createSqliteAdapter(db, taskModels);
		adapter.createTables();
		adapter.assertModels();
		const input = { name: 'Ada', active: true, metadata: { tier: 'free' } };
		const created = await adapter.create<Task>('tasks', input);
		expect(created).toMatchObject({ id: 1, ...input });
		expect(created.updatedAt).toBeTruthy();
		record('SqliteAdapter.create', 'creates-a-task-row-with-declared-field-mappings', [
			{
				name: 'task with boolean and JSON fields',
				input: { table: 'tasks', input },
				output: created
			}
		]);
	});
});

test('Finds tasks by id and declared field filters', async () => {
	await withDatabase(async (db) => {
		const adapter = adapterFor(db);
		const ada = await adapter.create<Task>('tasks', {
			name: 'Ada',
			active: true,
			metadata: { tier: 'free' }
		});
		await adapter.create<Task>('tasks', {
			name: 'Grace',
			active: false,
			metadata: { tier: 'team' }
		});
		const found = await adapter.find<Task>('tasks', ada.id);
		const missing = await adapter.find<Task>('tasks', 999);
		const fields = { active: true, metadata: { tier: 'free' } };
		const matches = await adapter.findBy<Task>('tasks', fields);
		expect(found).toEqual(ada);
		expect(missing).toBeNull();
		expect(matches).toEqual([ada]);
		record('SqliteAdapter.findBy', 'finds-tasks-by-id-and-declared-field-filters', [
			{
				name: 'id lookup and boolean plus JSON field filter',
				input: { table: 'tasks', id: ada.id, fields },
				output: { found, missing, matches }
			}
		]);
	});
});

test('Updates a task and refreshes its timestamp', async () => {
	await withDatabase(async (db) => {
		const adapter = adapterFor(db);
		const created = insertTask(adapter);
		const input = { active: false };
		const updated = await adapter.update<Task>('tasks', created.id, input);
		expect(updated).toMatchObject({ id: created.id, name: 'Ada', active: false });
		expect(updated?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		record('SqliteAdapter.update', 'updates-a-task-and-refreshes-its-timestamp', [
			{
				name: 'replace active and refresh timestamp default',
				input: { table: 'tasks', id: created.id, input },
				output: updated && { ...updated }
			}
		]);
	});
});

test('Deletes a task and reports missing rows', async () => {
	await withDatabase(async (db) => {
		const adapter = adapterFor(db);
		const created = insertTask(adapter);
		const removed = await adapter.delete('tasks', created.id);
		const repeated = await adapter.delete('tasks', created.id);
		expect(removed).toBe(true);
		expect(repeated).toBe(false);
		record('SqliteAdapter.delete', 'deletes-a-task-and-reports-missing-rows', [
			{ name: 'remove a stored task', input: { table: 'tasks', id: created.id }, output: removed },
			{
				name: 'remove the same task again',
				input: { table: 'tasks', id: created.id },
				output: repeated
			}
		]);
	});
});

test('Runs caller SQL with positional bindings', async () => {
	await withDatabase(async (db) => {
		const adapter = adapterFor(db);
		const created = insertTask(adapter);
		const sql = 'UPDATE tasks SET active = ? WHERE id = ?';
		const execution = adapter.execute(sql, [0, created.id]);
		const query = 'SELECT id, name FROM tasks WHERE id = ?';
		const rows = adapter.query<{ id: number; name: string }>(query, [created.id]);
		const output = {
			execution: {
				changes: Number(execution.changes),
				lastInsertRowid: Number(execution.lastInsertRowid)
			},
			rows
		};
		expect(execution.changes).toBe(1);
		expect(rows).toEqual([{ id: created.id, name: 'Ada' }]);
		record('SqliteAdapter.query', 'runs-caller-sql-with-positional-bindings', [
			{
				name: 'bound update followed by a bound select',
				input: {
					execute: { sql, bindings: [0, created.id] },
					query: { sql: query, bindings: [created.id] }
				},
				output
			}
		]);
	});
});

test('Commits synchronous inserts and rolls back failed writes', async () => {
	await withDatabase(async (db) => {
		const adapter = adapterFor(db);
		const committed = adapter.transaction(() => {
			const inserted = insertTask(adapter);
			return { id: inserted.id, name: inserted.name };
		});
		let rollbackMessage = '';
		try {
			adapter.transaction(() => {
				insertTask(adapter, 'Grace', 'team');
				throw new Error('rollback example');
			});
		} catch (error) {
			if (!(error instanceof Error)) throw error;
			rollbackMessage = error.message;
		}
		const rows = adapter.query<{ name: string }>('SELECT name FROM tasks ORDER BY id');
		expect(committed).toEqual({ id: 1, name: 'Ada' });
		expect(rollbackMessage).toBe('rollback example');
		expect(rows).toEqual([{ name: 'Ada' }]);
		record(
			'SqliteAdapter.transaction',
			'commits-synchronous-inserts-and-rolls-back-failed-writes',
			[
				{
					name: 'return inserted task after savepoint release',
					input: { write: 'insert and return id and name' },
					output: committed
				},
				{
					name: 'rollback inserted task when callback throws',
					input: { write: 'insert and throw', name: 'Grace' },
					error: rollbackMessage
				}
			]
		);
	});
});
