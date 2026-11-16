import { test } from 'vitest';
import type { SqliteModel } from '../../src/core/development-tooling/sqliteTypes';
import { createSqliteAdapter } from '../../src/models/adapters/sqlite';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const database = {
	prepare: (_sql: string) => ({
		run: () => ({ changes: 0, lastInsertRowid: 0 }),
		get: () => undefined,
		all: () => []
	}),
	exec: (_sql: string) => undefined,
	close: () => undefined
};

test('Registers a valid model declaration', () => {
	const models = [
		{
			table: 'users',
			primaryKey: 'id',
			fields: {
				id: { type: 'number' },
				email: { type: 'string' },
				createdAt: { type: 'string', default: 'timestamp' }
			}
		}
	] as const;
	const adapter = createSqliteAdapter(database, models);

	expect(adapter).toBeDefined();
	recordExampleCases(
		{
			unitId: 'model.adapters-sqlite',
			symbol: 'createSqliteAdapter',
			state: 'registers-a-valid-model-declaration',
			evidence: 'examples-cases',
			file: 'registers-a-valid-model-declaration.json'
		},
		[
			{
				name: 'users model with a timestamp default is accepted',
				input: { models },
				output: { adapterCreated: true, table: 'users' }
			}
		]
	);
});

test('Rejects a model without its primary key field', () => {
	const models: SqliteModel[] = [{ table: 'users', fields: { email: { type: 'string' } } }];
	let error: unknown;
	try {
		createSqliteAdapter(database, models);
	} catch (caught) {
		error = caught;
	}

	expect(error).toBeInstanceOf(Error);
	recordExampleCases(
		{
			unitId: 'model.adapters-sqlite',
			symbol: 'createSqliteAdapter',
			state: 'rejects-a-model-without-its-primary-key-field',
			evidence: 'examples-cases',
			file: 'rejects-a-model-without-its-primary-key-field.json'
		},
		[
			{
				name: 'users model omits the default id primary key',
				input: { models },
				error: {
					name: error instanceof Error ? error.name : 'UnknownError',
					message: error instanceof Error ? error.message : 'No error was thrown'
				}
			}
		]
	);
});
