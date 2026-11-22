import { test } from 'vitest';
import { canonicalJson } from '../../src/utils/development-tooling/canonicalJson';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

test('Sorts nested object keys and preserves array order', () => {
	const nested = {
		b: 2,
		a: { y: 1, x: 0 },
		items: [{ z: 4, a: 3 }, 2]
	};
	const ordered = [{ b: 2, a: 1 }, { d: 4, c: 3 }];
	const nestedOutput = canonicalJson(nested);
	const orderedOutput = canonicalJson(ordered);

	expect(nestedOutput).toBe(
		'{"a":{"x":0,"y":1},"b":2,"items":[{"a":3,"z":4},2]}'
	);
	expect(orderedOutput).toBe('[{"a":1,"b":2},{"c":3,"d":4}]');
	recordExampleCases(
		{
			unitId: 'function.canonical-json',
			symbol: 'canonicalJson',
			state: 'sorts-nested-object-keys-and-preserves-array-order',
			evidence: 'examples-cases',
			file: 'sorts-nested-object-keys-and-preserves-array-order.json'
		},
		[
			{
				name: 'nested objects sorted while array order is retained',
				input: nested,
				output: nestedOutput
			},
			{
				name: 'objects in arrays sorted without reordering the array',
				input: ordered,
				output: orderedOutput
			}
		]
	);
});

test('Throws TypeError when a BigInt value remains', () => {
	const input = { count: BigInt(3) };
	let error: unknown;
	try {
		canonicalJson(input);
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(TypeError);
	recordExampleCases(
		{
			unitId: 'function.canonical-json',
			symbol: 'canonicalJson',
			state: 'throws-typeerror-when-a-bigint-value-remains',
			evidence: 'examples-cases',
			file: 'throws-typeerror-when-a-bigint-value-remains.json'
		},
		[
			{
				name: 'BigInt property cannot be serialized',
				input: { count: 'BigInt(3)' },
				error: 'TypeError'
			}
		]
	);
});

test('Throws RangeError when a cyclic value recurses', () => {
	const input: Record<string, unknown> = {};
	input.self = input;
	let error: unknown;
	try {
		canonicalJson(input);
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(RangeError);
	recordExampleCases(
		{
			unitId: 'function.canonical-json',
			symbol: 'canonicalJson',
			state: 'throws-rangeerror-when-a-cyclic-value-recurses',
			evidence: 'examples-cases',
			file: 'throws-rangeerror-when-a-cyclic-value-recurses.json'
		},
		[{ name: 'Self reference exhausts recursive sorting', input: { self: '[Circular]' }, error: 'RangeError' }]
	);
});
