import { test } from 'vitest';
import type {
	SqliteValue,
	SqliteStatement,
	SqliteDatabase,
	SqliteField,
	SqliteModel,
	PersistenceAdapter
} from '../../src/core/development-tooling/sqliteTypes';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

async function boundaryExample() {
	const values: SqliteValue[] = ['Ada', 7, 9n, new Uint8Array([1, 2]), null];
	const model = {
		table: 'accounts',
		primaryKey: 'accountId',
		fields: { accountId: { type: 'number' }, name: { type: 'string', nullable: true } }
	} satisfies SqliteModel;
	const field = model.fields.name satisfies SqliteField;
	const statement = {
		all: (..._bindings: SqliteValue[]) => [{ accountId: 7 }],
		get: (..._bindings: SqliteValue[]) => ({ accountId: 7 }),
		run: (..._bindings: SqliteValue[]) => ({ changes: 1, lastInsertRowid: 7 })
	} satisfies SqliteStatement;
	const database = {
		prepare: (_sql: string) => statement,
		exec: (_sql: string) => undefined,
		close: () => undefined
	} satisfies SqliteDatabase;
	const persistence = {
		find: async <T>(_table: string, _id: number | string) => ({ accountId: 7 } as T),
		findBy: async <T>(_table: string, _fields: Record<string, unknown>) => ([{ accountId: 7 }] as T[]),
		create: async <T>(_table: string, input: Record<string, unknown>) => input as T,
		update: async <T>(_table: string, _id: number | string, input: Record<string, unknown>) => input as T,
		delete: async (_table: string, _id: number | string) => true
	} satisfies PersistenceAdapter;
	return {
		valueKinds: values.map((value) => value === null ? 'null' : typeof value),
		table: model.table,
		primaryKey: model.primaryKey,
		nullableName: field.nullable,
		row: database.prepare('select').get(),
		allRows: statement.all(),
		run: statement.run(),
		found: await persistence.find('accounts', 7),
		filtered: await persistence.findBy('accounts', { name: 'Ada' }),
		created: await persistence.create('accounts', { name: 'Ada' }),
		updated: await persistence.update('accounts', 7, { name: 'Grace' }),
		deleted: await persistence.delete('accounts', 7)
	};
}

test('SQLite types describe adapter boundaries', async () => {
	const output = await boundaryExample();
	expect(output).toMatchObject({
		table: 'accounts', primaryKey: 'accountId', nullableName: true,
		row: { accountId: 7 }, deleted: true
	});
	recordExampleCases(
		{
			unitId: 'function.sqlite-types',
			symbol: 'SqliteValue',
			state: 'sqlite-types-describe-adapter-boundaries',
			evidence: 'examples-cases',
			file: 'sqlite-types-describe-adapter-boundaries.json'
		},
		[{
			name: 'account model and SQLite adapter operations',
			input: { values: ['Ada', 7, '9n', [1, 2], null], table: 'accounts', id: 7 },
			output
		}]
	);
});
