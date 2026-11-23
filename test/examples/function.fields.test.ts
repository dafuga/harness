import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { parseFields } from '../../src/core/development-tooling/fields/fields';

test('Throws ExpectedCliError when a field has multiple colons', () => {
	const input = ['author:display:name'];
	expect(() => parseFields(input)).toThrow('Use name:type.');
	recordExampleCases(
		{
			unitId: 'function.fields',
			symbol: 'parseFields',
			state: 'throws-expectedclierror-when-a-field-has-multiple-colons',
			evidence: 'examples-cases',
			file: 'throws-expectedclierror-when-a-field-has-multiple-colons.json'
		},
		[{ name: 'rejects multiple colons', input, error: 'Use name:type.' }]
	);
});

test('Throws ExpectedCliError when a field name is invalid', () => {
	const input = ['../secret:string'];
	expect(() => parseFields(input)).toThrow(
		'Field name cannot include path traversal or path separators.'
	);
	recordExampleCases(
		{
			unitId: 'function.fields',
			symbol: 'parseFields',
			state: 'throws-expectedclierror-when-a-field-name-is-invalid',
			evidence: 'examples-cases',
			file: 'throws-expectedclierror-when-a-field-name-is-invalid.json'
		},
		[
			{
				name: 'rejects a field name with path traversal',
				input,
				error: 'Field name cannot include path traversal or path separators.'
			}
		]
	);
});

test('Throws ExpectedCliError when a field type is unsupported', () => {
	const input = ['status:integer'];
	expect(() => parseFields(input)).toThrow('Unsupported field type');
	recordExampleCases(
		{
			unitId: 'function.fields',
			symbol: 'parseFields',
			state: 'throws-expectedclierror-when-a-field-type-is-unsupported',
			evidence: 'examples-cases',
			file: 'throws-expectedclierror-when-a-field-type-is-unsupported.json'
		},
		[{ name: 'rejects unsupported type', input, error: 'Unsupported field type "integer".' }]
	);
});

test('Throws ExpectedCliError when field names duplicate after normalization', () => {
	const input = ['first-name:string', 'first_name:number'];
	expect(() => parseFields(input)).toThrow('Duplicate field');
	recordExampleCases(
		{
			unitId: 'function.fields',
			symbol: 'parseFields',
			state: 'throws-expectedclierror-when-field-names-duplicate-after-nor',
			evidence: 'examples-cases',
			file: 'throws-expectedclierror-when-field-names-duplicate-after-nor.json'
		},
		[
			{
				name: 'rejects duplicate camelCase names',
				input,
				error: 'Duplicate field "firstName".'
			}
		]
	);
});

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
		{
			name: 'published',
			column: 'published',
			type: 'boolean',
			tsType: 'boolean',
			sqlType: 'INTEGER'
		},
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
