import { test } from 'vitest';
import type { SqliteModel } from '../../src/core/development-tooling/sqliteTypes';
import { sqliteRow } from '../../src/utils/development-tooling/sqliteRow';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const model = {
	table: 'units',
	primaryKey: 'id',
	fields: {
		id: { type: 'number' },
		uid: { type: 'string' },
		title: { type: 'string' },
		contract: { type: 'json', nullable: true },
		active: { type: 'boolean', column: 'is_active' }
	}
} satisfies SqliteModel;

function recordDecodeCases() {
	const rows = [
		{
			name: 'parses JSON and coerces a stored true boolean',
			input: { model, row: { id: 7, uid: 'u_hz4b2ps734', title: 'sqliteRow', contract: '{"origin":"declared"}', is_active: 1 } },
			output: { id: 7, uid: 'u_hz4b2ps734', title: 'sqliteRow', contract: { origin: 'declared' }, active: true }
		},
		{
			name: 'preserves null JSON and coerces a stored false boolean',
			input: { model, row: { id: 8, uid: 'u_9x2kq0d1mz', title: 'sqliteColumn', contract: null, is_active: 0 } },
			output: { id: 8, uid: 'u_9x2kq0d1mz', title: 'sqliteColumn', contract: null, active: false }
		},
		{ name: 'returns null for a null row', input: { model, row: null }, output: null },
		{ name: 'rejects invalid JSON text', input: { model, row: { contract: 'not-json' } }, error: 'SyntaxError' }
	];
	recordExampleCases(
		{
			unitId: 'function.sqlite-row', symbol: 'sqliteRow',
			state: 'decodes-sqlite-rows-into-model-properties',
			evidence: 'examples-cases', file: 'decodes-sqlite-rows-into-model-properties.json'
		},
		rows
	);
}

test('Decodes SQLite rows into model properties', () => {
	expect(sqliteRow(model, { id: 7, uid: 'u_hz4b2ps734', title: 'sqliteRow', contract: '{"origin":"declared"}', is_active: 1 })).toEqual({
		id: 7, uid: 'u_hz4b2ps734', title: 'sqliteRow', contract: { origin: 'declared' }, active: true
	});
	recordDecodeCases();
});
