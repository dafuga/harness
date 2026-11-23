import { test } from 'vitest';
import {
	canonicalContract,
	compareContractFields,
	isRecord
} from '../../src/commands/development-tooling/contracts-command/contractSemantics';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const unitId = 'command.development-tooling-contracts-command-contract-semantics';
const evidence = 'examples-cases';

const original = {
	contract: {
		operations: [
			{ name: 'parse', inputs: [{ name: 'file', type: 'string' }] },
			{
				name: 'compare',
				inputs: [
					{ name: 'before', type: 'object' },
					{ name: 'after', type: 'object' }
				]
			}
		],
		examples: ['parse first', 'compare second']
	},
	owns: { source: ['src/z.ts', 'src/a.ts'] },
	legacyValues: ['older', 'newer'],
	note: '  keep whitespace  '
};
const reorderedMetadata = {
	note: '  keep whitespace  ',
	legacyValues: ['older', 'newer'],
	owns: { source: ['src/a.ts', 'src/z.ts'] },
	contract: {
		examples: ['parse first', 'compare second'],
		operations: [
			{
				inputs: [
					{ type: 'object', name: 'after' },
					{ type: 'object', name: 'before' }
				],
				name: 'compare'
			},
			{ inputs: [{ type: 'string', name: 'file' }], name: 'parse' }
		]
	}
};
const reorderedExamples = {
	...original,
	contract: { ...original.contract, examples: [...original.contract.examples].reverse() },
	legacyValues: [...original.legacyValues].reverse()
};

test('Canonicalizes named metadata while preserving ordered data', () => {
	const originalKey = canonicalContract(original);
	const reorderedKey = canonicalContract(reorderedMetadata);
	const orderedDataKey = canonicalContract(reorderedExamples);
	const forcedOrderKey = canonicalContract(original, '', true);

	expect(originalKey).toBe(reorderedKey);
	expect(originalKey).not.toBe(orderedDataKey);
	expect(originalKey).toContain('"note":"  keep whitespace  "');
	expect(originalKey).not.toBe(forcedOrderKey);
	recordExampleCases(
		{
			unitId,
			symbol: 'canonicalContract',
			state: 'canonicalizes-named-metadata-while-preserving-ordered-data',
			evidence,
			file: 'canonicalizes-named-metadata-while-preserving-ordered-data.json'
		},
		[
			{ name: 'metadata in its original order', input: { data: original }, output: originalKey },
			{
				name: 'metadata with reordered named operations and object keys',
				input: { data: reorderedMetadata },
				output: reorderedKey
			},
			{
				name: 'examples and historical arrays in reverse order',
				input: { data: reorderedExamples },
				output: orderedDataKey
			},
			{
				name: 'original contract with ordered mode enabled',
				input: { data: original, path: '', ordered: true },
				output: forcedOrderKey
			}
		]
	);
});

test('Compares named fields and duplicate dependencies', () => {
	const before = {
		contract: {
			operations: [
				{ name: 'parse', description: 'Reads a contract file' },
				{ name: 'compare', description: 'Compares two contracts' }
			]
		},
		dependencies: []
	};
	const after = {
		contract: {
			operations: [
				{ name: 'compare', description: 'Compares two contracts' },
				{ name: 'parse', description: 'Reads stored contract JSON' }
			]
		},
		dependencies: [
			{ unit: 'command.contract-reader', via: 'import' },
			{ unit: 'command.contract-reader', via: 'import' }
		]
	};
	const changes = compareContractFields(before, after);

	expect(changes).toEqual([
		{
			path: 'operations[parse].description',
			kind: 'changed',
			before: 'Reads a contract file',
			after: 'Reads stored contract JSON'
		},
		{
			path: 'dependencies[command.contract-reader;via=import;relation=]',
			kind: 'added',
			after: { unit: 'command.contract-reader', via: 'import' }
		},
		{
			path: 'dependencies[command.contract-reader;via=import;relation=#2]',
			kind: 'added',
			after: { unit: 'command.contract-reader', via: 'import' }
		}
	]);
	recordExampleCases(
		{
			unitId,
			symbol: 'compareContractFields',
			state: 'compares-named-fields-and-duplicate-dependencies',
			evidence,
			file: 'compares-named-fields-and-duplicate-dependencies.json'
		},
		[
			{
				name: 'changed operation and two repeated dependency additions',
				input: { before, after },
				output: changes
			}
		]
	);
});

test('Classifies JSON records and rejects arrays or null', () => {
	const inputs = [
		{ name: 'unit contract object', input: { id: 'command.contract-reader', kind: 'command' } },
		{ name: 'array of contract entries', input: [{ name: 'parse' }] },
		{ name: 'JSON null', input: null },
		{ name: 'JSON string', input: 'contract' }
	];
	const results = inputs.map(({ input }) => isRecord(input));

	expect(results).toEqual([true, false, false, false]);
	recordExampleCases(
		{
			unitId,
			symbol: 'isRecord',
			state: 'classifies-json-records-and-rejects-arrays-or-null',
			evidence,
			file: 'classifies-json-records-and-rejects-arrays-or-null.json'
		},
		inputs.map(({ name, input }, index) => ({ name, input, output: results[index] }))
	);
});
