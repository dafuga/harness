import { test } from 'vitest';
import { stableJson } from '../../src/utils/development-tooling/stableJson';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

/**
 * Each state calls stableJson as its callers do, then asserts and records what it returned or
 * threw.
 */

const manifestHeader = {
	schemaVersion: 1,
	id: 'function.stable-json',
	status: 'active',
	scenarios: []
};
const moduleWithScenario = {
	module: { id: 'function.stable-json', kind: 'function' },
	scenarios: [{ id: 'examples-function.stable-json', kind: 'headless' }]
};
const longPaths = [
	'src/utils/development-tooling/stableJson.ts',
	'src/utils/development-tooling/stableJson.types.ts',
	'src/utils/stableJson.ts'
];
const hundredColumnPaths = [
	'src/utils/development-tooling/stableJson.ts',
	'src/utils/development-tooling/stableJson.types.ts'
];

/** The name of the error that a call throws, or 'none' when the call returns normally. */
function thrownName(render: () => unknown): string {
	try {
		render();
	} catch (error) {
		return error instanceof Error ? error.name : 'non-error';
	}
	return 'none';
}

test('Formats nested objects with tab indentation', () => {
	const header = stableJson(manifestHeader);
	const nested = stableJson(moduleWithScenario);
	expect(header).toBe(
		'{\n\t"schemaVersion": 1,\n\t"id": "function.stable-json",\n\t"status": "active",\n' +
			'\t"scenarios": []\n}\n'
	);
	expect(nested).toBe(
		'{\n\t"module": {\n\t\t"id": "function.stable-json",\n\t\t"kind": "function"\n\t},\n' +
			'\t"scenarios": [\n\t\t{\n\t\t\t"id": "examples-function.stable-json",\n' +
			'\t\t\t"kind": "headless"\n\t\t}\n\t]\n}\n'
	);
	recordExampleCases(
		{
			unitId: 'function.stable-json',
			symbol: 'stableJson',
			state: 'formats-nested-objects-with-tab-indentation',
			evidence: 'examples-cases',
			file: 'formats-nested-objects-with-tab-indentation.json'
		},
		[
			{ name: 'a manifest header with no scenarios', input: manifestHeader, output: header },
			{ name: 'a module whose scenarios hold an object', input: moduleWithScenario, output: nested }
		]
	);
});

test('Keeps primitive arrays on one line only within 100 columns', () => {
	const short = stableJson(['stableJson', 'Position']);
	const wrapped = stableJson(longPaths);
	const hundred = stableJson(hundredColumnPaths);
	const keyed = stableJson({ paths: hundredColumnPaths });
	expect(short).toBe('["stableJson", "Position"]\n');
	expect(wrapped).toBe(
		'[\n\t"src/utils/development-tooling/stableJson.ts",\n' +
			'\t"src/utils/development-tooling/stableJson.types.ts",\n\t"src/utils/stableJson.ts"\n]\n'
	);
	expect(hundred).toBe(
		'["src/utils/development-tooling/stableJson.ts", "src/utils/development-tooling/stableJson.types.ts"]\n'
	);
	expect(keyed).toBe(
		'{\n\t"paths": [\n\t\t"src/utils/development-tooling/stableJson.ts",\n' +
			'\t\t"src/utils/development-tooling/stableJson.types.ts"\n\t]\n}\n'
	);
	recordExampleCases(
		{
			unitId: 'function.stable-json',
			symbol: 'stableJson',
			state: 'keeps-primitive-arrays-on-one-line-only-within-100-columns',
			evidence: 'examples-cases',
			file: 'keeps-primitive-arrays-on-one-line-only-within-100-columns.json'
		},
		[
			{ name: 'two short strings stay flat', input: ['stableJson', 'Position'], output: short },
			{ name: 'three paths of 127 columns wrap', input: longPaths, output: wrapped },
			{ name: 'two paths of 100 columns stay flat', input: hundredColumnPaths, output: hundred },
			{
				name: 'two paths under a key wrap, as the key counts',
				input: { paths: hundredColumnPaths },
				output: keyed
			}
		]
	);
});

test('Drops undefined fields and writes nullish items as null', () => {
	const withUndefined = stableJson({ id: 'stableJson', note: undefined, owner: null });
	const nullishItems = stableJson(['stableJson', undefined, null]);
	const nullishValue = stableJson(undefined);
	expect(withUndefined).toBe('{\n\t"id": "stableJson",\n\t"owner": null\n}\n');
	expect(nullishItems).toBe('["stableJson", null, null]\n');
	expect(nullishValue).toBe('null\n');
	recordExampleCases(
		{
			unitId: 'function.stable-json',
			symbol: 'stableJson',
			state: 'drops-undefined-fields-and-writes-nullish-items-as-null',
			evidence: 'examples-cases',
			file: 'drops-undefined-fields-and-writes-nullish-items-as-null.json'
		},
		[
			{
				name: 'an undefined object field is left out',
				input: { id: 'stableJson', note: { type: 'undefined' }, owner: null },
				output: withUndefined
			},
			{
				name: 'undefined and null array items are written as null',
				input: ['stableJson', { type: 'undefined' }, null],
				output: nullishItems
			},
			{ name: 'an undefined top-level value', input: { type: 'undefined' }, output: nullishValue }
		]
	);
});

test('Throws TypeError for BigInt and circular array items', () => {
	const cyclic: Record<string, unknown> = { id: 'stableJson' };
	cyclic.self = cyclic;
	const bigIntFieldError = thrownName(() => stableJson({ retries: 3n }));
	const bigIntValueError = thrownName(() => stableJson(3n));
	const circularItemError = thrownName(() => stableJson([cyclic]));
	expect(bigIntFieldError).toBe('TypeError');
	expect(bigIntValueError).toBe('TypeError');
	expect(circularItemError).toBe('TypeError');
	recordExampleCases(
		{
			unitId: 'function.stable-json',
			symbol: 'stableJson',
			state: 'throws-typeerror-for-bigint-and-circular-array-items',
			evidence: 'examples-cases',
			file: 'throws-typeerror-for-bigint-and-circular-array-items.json'
		},
		[
			{
				name: 'a BigInt object field cannot be serialized',
				input: { retries: { type: 'bigint', value: '3' } },
				error: bigIntFieldError
			},
			{
				name: 'a BigInt top-level value cannot be serialized',
				input: { type: 'bigint', value: '3' },
				error: bigIntValueError
			},
			{
				name: 'an array item that refers to itself',
				input: [{ id: 'stableJson', self: { type: 'circular', field: 'self' } }],
				error: circularItemError
			}
		]
	);
});

test('Throws RangeError for circular object fields', () => {
	const selfReference: Record<string, unknown> = { id: 'stableJson' };
	selfReference.self = selfReference;
	const first: Record<string, unknown> = { id: 'a' };
	const second: Record<string, unknown> = { id: 'b', next: first };
	first.next = second;
	const selfError = thrownName(() => stableJson(selfReference));
	const pairError = thrownName(() => stableJson(first));
	expect(selfError).toBe('RangeError');
	expect(pairError).toBe('RangeError');
	recordExampleCases(
		{
			unitId: 'function.stable-json',
			symbol: 'stableJson',
			state: 'throws-rangeerror-for-circular-object-fields',
			evidence: 'examples-cases',
			file: 'throws-rangeerror-for-circular-object-fields.json'
		},
		[
			{
				name: 'an object whose field refers to itself',
				input: { id: 'stableJson', self: { type: 'circular', field: 'self' } },
				error: selfError
			},
			{
				name: 'two objects whose fields refer to each other',
				input: { id: 'a', next: { id: 'b', next: { type: 'circular', field: 'next' } } },
				error: pairError
			}
		]
	);
});
