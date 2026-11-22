import { test } from 'vitest';
import type { SqliteModel } from '../../src/core/development-tooling/sqliteTypes';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { sqliteInput } from '../../src/utils/development-tooling/sqliteInput';

const reportModel: SqliteModel = {
	table: 'reports',
	primaryKey: 'id',
	fields: {
		id: { type: 'number' },
		title: { type: 'string' },
		isPublished: { type: 'boolean' },
		metadata: { type: 'json', nullable: true },
		createdAt: { type: 'string', default: 'timestamp' }
	}
};

const runModel: SqliteModel = {
	table: 'report_runs',
	fields: {
		reportTitle: { type: 'string', column: 'report_name' },
		durationMs: { type: 'number' },
		logBytes: { type: 'blob', nullable: true },
		archivedAt: { type: 'string', nullable: true }
	}
};

test('Binds partial model input in key order', () => {
	const input = {
		title: 'Quarterly sales report',
		isPublished: true,
		metadata: { tags: ['q3', 'sales'] }
	};
	const output = sqliteInput(reportModel, input);
	expect(output).toEqual([
		{ column: '"title"', value: 'Quarterly sales report' },
		{ column: '"is_published"', value: 1 },
		{ column: '"metadata"', value: '{"tags":["q3","sales"]}' }
	]);
	recordExampleCases(
		{
			unitId: 'function.sqlite-input',
			symbol: 'sqliteInput',
			state: 'binds-partial-model-input-in-key-order',
			evidence: 'examples-cases',
			file: 'binds-partial-model-input-in-key-order.json'
		},
		[
			{ name: 'binds report fields and skips omitted fields', input, output },
			{
				name: 'binds renamed run column and nullable value',
				input: { reportTitle: 'Quarterly sales report', durationMs: 1250, archivedAt: null },
				output: sqliteInput(runModel, {
					reportTitle: 'Quarterly sales report', durationMs: 1250, archivedAt: null
				})
			}
		]
	);
});

test('Rejects a key absent from the model fields', () => {
	let error = '';
	try {
		sqliteInput(reportModel, { missingField: 1 });
	} catch (caught) {
		error = caught instanceof Error ? caught.message : String(caught);
	}
	expect(error).toBe('Unknown SQLite field: missingField');
	recordExampleCases(
		{
			unitId: 'function.sqlite-input',
			symbol: 'sqliteInput',
			state: 'rejects-a-key-absent-from-the-model-fields',
			evidence: 'examples-cases',
			file: 'rejects-a-key-absent-from-the-model-fields.json'
		},
		[
			{
				name: 'unknown property throws before returning bindings',
				input: { missingField: 1 },
				error
			}
		]
	);
});
