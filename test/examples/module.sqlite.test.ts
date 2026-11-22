import { test } from 'vitest';
import { createSqliteAdapter } from '../../src/adapters/development-tooling/SqliteAdapter';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

test('Creates a modeled SQLite table', () => {
	const statements: string[] = [];
	const database = {
		exec(sql: string) {
			statements.push(sql);
		},
		prepare() {
			return {
				all: () => [],
				get: () => undefined,
				run: () => ({ changes: 0, lastInsertRowid: 0 })
			};
		},
		close() {}
	};
	const model = {
		table: 'users',
		fields: {
			id: { type: 'number' as const },
			displayName: { type: 'string' as const }
		}
	};
	const adapter = createSqliteAdapter(database, [model]);
	adapter.createTables();

	expect(statements).toEqual([
		'CREATE TABLE IF NOT EXISTS "users" ("id" INTEGER PRIMARY KEY, "display_name" TEXT NOT NULL)'
	]);
	recordExampleCases(
		{
			unitId: 'module.sqlite',
			symbol: 'createTables',
			state: 'creates-a-modeled-sqlite-table',
			evidence: 'examples-cases',
			file: 'creates-a-modeled-sqlite-table.json'
		},
		[
			{
				name: 'creates the declared users table with a normalized column name',
				input: { table: 'users', fields: ['id:number', 'displayName:string'] },
				output: statements[0]
			}
		]
	);
});
