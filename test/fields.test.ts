import { expect, test } from 'vitest';
import { parseFields } from '../src/core/fields';

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

test('rejects malformed, duplicate, and unsupported fields', () => {
	expect(() => parseFields(['bad:field:type'])).toThrow('Use name:type');
	expect(() => parseFields(['title:string', 'Title:text'])).toThrow('Duplicate field');
	expect(() => parseFields(['title:uuid'])).toThrow('Unsupported field type');
	expect(() => parseFields(['../title:string'])).toThrow('path traversal');
});
