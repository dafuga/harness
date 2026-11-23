import { test } from 'vitest';
import type { SqliteModel } from '../../src/core/development-tooling/sqliteTypes';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	sqliteIdentifier,
	sqliteColumn,
	sqliteTableSql
} from '../../src/utils/development-tooling/sqliteTableSql';

const errorResult = (error: unknown) =>
	error instanceof Error ? { name: error.name, message: error.message } : String(error);

const capture = (run: () => string) => {
	try {
		return { output: run() };
	} catch (error) {
		return { error: errorResult(error) };
	}
};

const tableModels: SqliteModel[] = [
	{
		table: 'units',
		primaryKey: 'id',
		fields: {
			id: { type: 'number' },
			title: { type: 'string' },
			createdAt: { type: 'string', default: 'timestamp' }
		}
	},
	{
		table: 'reports',
		primaryKey: 'reportId',
		fields: {
			reportId: { type: 'string', column: 'report_id' },
			body: { type: 'json', nullable: true }
		}
	}
];

test('Quotes valid SQLite identifiers and rejects unsafe names', () => {
	const safe = ['unit_records', 'created_at', '_sync_token'].map((identifier) => ({
		name: identifier,
		input: identifier,
		output: sqliteIdentifier(identifier)
	}));
	const unsafeInput = 'unit records';
	const unsafe = capture(() => sqliteIdentifier(unsafeInput));
	expect(safe.map((item) => item.output)).toEqual([
		'"unit_records"',
		'"created_at"',
		'"_sync_token"'
	]);
	expect(unsafe).toEqual({
		error: {
			name: 'InvalidSqliteDefinitionError',
			message: 'Invalid SQLite identifier: unit records'
		}
	});
	recordExampleCases(
		{
			unitId: 'function.sqlite-table-sql',
			symbol: 'sqliteIdentifier',
			state: 'quotes-valid-sqlite-identifiers-and-rejects-unsafe-names',
			evidence: 'examples-cases',
			file: 'quotes-valid-sqlite-identifiers-and-rejects-unsafe-names.json'
		},
		[
			...safe.map(({ name, input, output }) => ({ name, input, output })),
			{ name: 'spaces are rejected', input: unsafeInput, error: unsafe.error }
		]
	);
});

test('Maps properties to SQLite columns', () => {
	const samples = [
		{ property: 'createdAt', field: { type: 'string' as const } },
		{ property: 'unitId', field: { type: 'string' as const } },
		{ property: 'title', field: { type: 'string' as const, column: 'report_id' } },
		{ property: 'ignored', field: { type: 'json' as const, column: '' } }
	];
	const cases = samples.map(({ property, field }) => ({
		name: `${property} maps to ${sqliteColumn(property, field) || 'an empty explicit column'}`,
		input: { property, field },
		output: sqliteColumn(property, field)
	}));
	expect(cases.map((item) => item.output)).toEqual(['created_at', 'unit_id', 'report_id', '']);
	recordExampleCases(
		{
			unitId: 'function.sqlite-table-sql',
			symbol: 'sqliteColumn',
			state: 'maps-properties-to-sqlite-columns',
			evidence: 'examples-cases',
			file: 'maps-properties-to-sqlite-columns.json'
		},
		cases
	);
});

test('Builds ordered table SQL with mapped types and constraints', () => {
	const cases = tableModels.map((model) => ({
		name: `${model.table} uses its declared primary key and field order`,
		input: model,
		output: sqliteTableSql(model)
	}));
	expect(cases.map((item) => item.output)).toEqual([
		'CREATE TABLE IF NOT EXISTS "units" ("id" INTEGER PRIMARY KEY, "title" TEXT NOT NULL, "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)',
		'CREATE TABLE IF NOT EXISTS "reports" ("report_id" TEXT PRIMARY KEY NOT NULL, "body" TEXT)'
	]);
	recordExampleCases(
		{
			unitId: 'function.sqlite-table-sql',
			symbol: 'sqliteTableSql',
			state: 'builds-ordered-table-sql-with-mapped-types-and-constraints',
			evidence: 'examples-cases',
			file: 'builds-ordered-table-sql-with-mapped-types-and-constraints.json'
		},
		cases
	);
});
