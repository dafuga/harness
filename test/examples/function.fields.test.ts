import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { parseFields } from '../../src/core/development-tooling/fields/fields';

test('Parses supported field specifications', () => {
	const rawFields = [
		'title',
		'body:text',
		'views:number',
		'published:boolean',
		'settings:json',
		'due: date '
	];
	const fields = parseFields(rawFields);
	const output = fields.map(({ name, column, type, tsType, sqlType }) => ({
		name,
		column,
		type,
		tsType,
		sqlType
	}));

	expect(output).toEqual([
		{ name: 'title', column: 'title', type: 'string', tsType: 'string', sqlType: 'TEXT' },
		{ name: 'body', column: 'body', type: 'text', tsType: 'string', sqlType: 'TEXT' },
		{ name: 'views', column: 'views', type: 'number', tsType: 'number', sqlType: 'INTEGER' },
		{ name: 'published', column: 'published', type: 'boolean', tsType: 'boolean', sqlType: 'INTEGER' },
		{
			name: 'settings',
			column: 'settings',
			type: 'json',
			tsType: 'Record<string, unknown>',
			sqlType: 'TEXT'
		},
		{ name: 'due', column: 'due', type: 'date', tsType: 'string', sqlType: 'TEXT' }
	]);
	recordExampleCases(
		{
			unitId: 'function.fields',
			symbol: 'parseFields',
			state: 'parses-supported-field-specifications',
			evidence: 'examples-cases',
			file: 'parses-supported-field-specifications.json'
		},
		[
			{
				name: 'defaults an omitted type and maps all supported types',
				input: rawFields,
				output
			}
		]
	);
});
