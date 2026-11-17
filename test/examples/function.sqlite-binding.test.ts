import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { sqliteBinding } from '../../src/utils/development-tooling/sqliteBinding';
import { InvalidSqliteFieldValueError } from '../../src/utils/development-tooling/sqliteBinding.types';

type Field = Parameters<typeof sqliteBinding>[1];

const jsonField = { type: 'json', nullable: false } as const;
const nullableString = { type: 'string', nullable: true } as const;
const requiredNumber = { type: 'number', nullable: false } as const;

function failureOf(value: unknown, field: Field) {
	try {
		sqliteBinding(value, field);
		return undefined;
	} catch (error) {
		return error instanceof Error ? { name: error.name, message: error.message } : error;
	}
}

function encodingCases(profile: unknown, outputs: Record<string, unknown>) {
	return [
		{
			name: 'object is serialized as JSON text in a json field',
			input: { value: profile, field: jsonField },
			output: outputs.json
		},
		{
			name: 'null in a non-nullable json field becomes the text null',
			input: { value: null, field: jsonField },
			output: outputs.jsonNull
		},
		{
			name: 'string passes through a nullable string field',
			input: { value: 'Ada Lovelace', field: nullableString },
			output: outputs.string
		},
		{
			name: 'null in a nullable string field binds as null',
			input: { value: null, field: nullableString },
			output: null
		},
		{
			name: 'true is bound as 1 in a boolean field',
			input: { value: true, field: { type: 'boolean', nullable: false } },
			output: 1
		},
		{
			name: 'finite number passes through a number field',
			input: { value: 25, field: requiredNumber },
			output: 25
		},
		{
			name: 'blob bytes are returned as the same Uint8Array',
			input: { value: [1, 2, 3], field: { type: 'blob', nullable: false } },
			output: [1, 2, 3]
		}
	];
}

test('Encodes application values for each SQLite field type', () => {
	const bytes = new Uint8Array([1, 2, 3]);
	const profile = { theme: 'dark', pageSize: 25 };
	const outputs = {
		json: sqliteBinding(profile, jsonField),
		jsonNull: sqliteBinding(null, jsonField),
		string: sqliteBinding('Ada Lovelace', nullableString),
		nullableNull: sqliteBinding(null, nullableString),
		boolean: sqliteBinding(true, { type: 'boolean', nullable: false }),
		number: sqliteBinding(25, requiredNumber),
		blob: sqliteBinding(bytes, { type: 'blob', nullable: false })
	};

	expect(outputs).toEqual({
		json: '{"theme":"dark","pageSize":25}',
		jsonNull: 'null',
		string: 'Ada Lovelace',
		nullableNull: null,
		boolean: 1,
		number: 25,
		blob: new Uint8Array([1, 2, 3])
	});
	expect(outputs.blob).toBe(bytes);
	recordExampleCases(
		{
			unitId: 'function.sqlite-binding',
			symbol: 'sqliteBinding',
			state: 'encodes-application-values-for-each-sqlite-field-type',
			evidence: 'examples-cases',
			file: 'encodes-application-values-for-each-sqlite-field-type.json'
		},
		encodingCases(profile, outputs)
	);
});

test('Rejects values that do not fit the declared field', () => {
	const wrongType = { type: 'number', nullable: false } as const;
	const unknownField = { type: 'date', nullable: false } as unknown as Field;
	const expected = (type: string) => ({
		name: 'InvalidSqliteFieldValueError',
		message: `Invalid SQLite ${type} field value`
	});

	expect(() => sqliteBinding(undefined, nullableString)).toThrow(InvalidSqliteFieldValueError);
	expect(failureOf('25', wrongType)).toEqual(expected('number'));
	expect(failureOf(Number.NaN, requiredNumber)).toEqual(expected('number'));
	expect(failureOf(null, { type: 'string', nullable: false })).toEqual(expected('string'));
	expect(failureOf('2026', unknownField)).toEqual(expected('date'));
	recordExampleCases(
		{
			unitId: 'function.sqlite-binding',
			symbol: 'sqliteBinding',
			state: 'rejects-values-that-do-not-fit-the-declared-field',
			evidence: 'examples-cases',
			file: 'rejects-values-that-do-not-fit-the-declared-field.json'
		},
		[
			{
				name: 'undefined is rejected even in a nullable field',
				input: { value: 'undefined', field: nullableString },
				error: expected('string')
			},
			{
				name: 'string in a number field is rejected',
				input: { value: '25', field: wrongType },
				error: expected('number')
			},
			{
				name: 'NaN in a number field is rejected',
				input: { value: 'NaN', field: requiredNumber },
				error: expected('number')
			},
			{
				name: 'null in a non-nullable string field is rejected',
				input: { value: null, field: { type: 'string', nullable: false } },
				error: expected('string')
			},
			{
				name: 'unsupported field type rejects a non-null value',
				input: { value: '2026', field: { type: 'date', nullable: false } },
				error: expected('date')
			}
		]
	);
});

test('Propagates JSON.stringify errors for json fields', () => {
	const bigintValue = { count: BigInt(1) };
	const circular: Record<string, unknown> = {};
	circular.self = circular;
	const throwingValue = {
		toJSON() {
			throw new RangeError('fixture toJSON failure');
		}
	};

	expect(() => sqliteBinding(bigintValue, jsonField)).toThrow(TypeError);
	expect(() => sqliteBinding(circular, jsonField)).toThrow(TypeError);
	expect(() => sqliteBinding(throwingValue, jsonField)).toThrow(RangeError);
	recordExampleCases(
		{
			unitId: 'function.sqlite-binding',
			symbol: 'sqliteBinding',
			state: 'propagates-json-stringify-errors-for-json-fields',
			evidence: 'examples-cases',
			file: 'propagates-json-stringify-errors-for-json-fields.json'
		},
		[
			{
				name: 'BigInt inside a json value throws a TypeError',
				input: { value: 'object with a BigInt count', field: jsonField },
				error: { name: 'TypeError' }
			},
			{
				name: 'circular reference inside a json value throws a TypeError',
				input: { value: 'object referencing itself', field: jsonField },
				error: { name: 'TypeError' }
			},
			{
				name: 'toJSON that throws propagates its own RangeError',
				input: { value: 'object whose toJSON throws', field: jsonField },
				error: { name: 'RangeError', message: 'fixture toJSON failure' }
			}
		]
	);
});
