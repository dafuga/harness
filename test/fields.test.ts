import { expect, test } from 'vitest';
import { parseFields } from '../src/core/development-tooling/fields/fields';
import { assertColdEntries } from './support/coldEntries';
import { measureWorkload } from './support/measureWorkload';

test('parses every supported field type', () => {
	const fields = parseFields([
		'title:string',
		'body:text',
		'views:number',
		'published:boolean',
		'publishDate:date',
		'metadata:json'
	]);

	expect(fields.map((field) => field.type)).toEqual([
		'string',
		'text',
		'number',
		'boolean',
		'date',
		'json'
	]);
	expect(fields.at(-1)?.tsType).toBe('Record<string, unknown>');
});

test('defaults fields to string type', () => {
	expect(parseFields(['title'])).toMatchObject([{ name: 'title', type: 'string' }]);
});

test('rejects malformed, duplicate, and unsupported fields', () =>
	measureWorkload('function.validation', 'validate-field-admission', () => {
		expect(() => parseFields(['bad:field:type'])).toThrow('Use name:type');
		expect(() => parseFields(['title:string', 'Title:text'])).toThrow('Duplicate field');
		expect(() => parseFields(['title:uuid'])).toThrow('Unsupported field type');
		expect(() => parseFields(['../title:string'])).toThrow('path traversal');
		const entries = [
			'src/core/validation.ts',
			'src/core/development-tooling/validation.ts',
			'src/core/development-tooling/fields/validation.ts',
			'src/core/development-tooling/fields/validateName.ts'
		];
		assertColdEntries(
			entries.map((entry) => ({
				entry,
				code: `console.log(JSON.stringify([' field-1 ', '../bad'].map((input) => { try { return ${entry.endsWith('/validateName.ts') ? "m.validateName(input, 'Field name')" : 'm.validateFieldName(input)'}; } catch (error) { return error.message; } })));`
			})),
			['field-1', 'Field name cannot include path traversal or path separators.']
		);
	}));
