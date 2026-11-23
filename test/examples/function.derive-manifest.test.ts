import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import type { DeriveInput } from '../../src/utils/development-tooling/deriveManifest';
import { deriveManifest } from '../../src/workflows/development-tooling/load-units/unit-index-service/deriveManifest';

function sampleInput(): DeriveInput {
	return {
		id: 'function.derive-manifest',
		kind: 'function',
		files: [
			{
				path: 'src/utils/development-tooling/deriveManifest.ts',
				hash: 'fixture-hash',
				bytes: 120,
				lines: 8,
				language: 'typescript',
				classification: 'source',
				workspace: 'root',
				read: true,
				decisions: {},
				references: [],
				blocks: [],
				exports: [
					{ name: 'deriveManifest', kind: 'function', inputs: [], output: 'ComponentManifest' }
				],
				errors: []
			}
		],
		owners: new Map()
	} as unknown as DeriveInput;
}

function summarize(input: DeriveInput) {
	const manifest = deriveManifest(input);
	return {
		id: manifest.id,
		title: manifest.title,
		status: manifest.status,
		source: manifest.owns.source,
		symbols: manifest.owns.symbols,
		runtime: manifest.runtime,
		operations: manifest.contract.operations
	};
}

test('Derives an active manifest from owned source facts', () => {
	const input = sampleInput();
	const output = summarize(input);
	expect(output).toEqual({
		id: 'function.derive-manifest',
		title: 'deriveManifest',
		status: 'active',
		source: ['src/utils/development-tooling/deriveManifest.ts'],
		symbols: ['deriveManifest'],
		runtime: {
			kind: 'module',
			entry: 'src/utils/development-tooling/deriveManifest.ts',
			targets: [{ kind: 'module', entry: 'src/utils/development-tooling/deriveManifest.ts' }]
		},
		operations: [
			{
				name: 'deriveManifest',
				inputs: [],
				outputs: [{ name: 'deriveManifest', type: 'ComponentManifest' }],
				errors: [],
				errorStatus: 'unknown'
			}
		]
	});
	recordExampleCases(
		{
			unitId: 'function.derive-manifest',
			symbol: 'deriveManifest',
			state: 'derives-an-active-manifest-from-owned-source-facts',
			evidence: 'examples-cases',
			file: 'derives-an-active-manifest-from-owned-source-facts.json'
		},
		[
			{
				name: 'one owned TypeScript source exports deriveManifest',
				input: { id: input.id, kind: input.kind, path: input.files[0].path },
				output
			}
		]
	);
});

test('Throws TypeError when there is no previous manifest and files are empty', () => {
	const input = { ...sampleInput(), files: [] };
	expect(() => deriveManifest(input)).toThrow(TypeError);
	let error: unknown;
	try {
		deriveManifest(input);
	} catch (caught) {
		error = caught;
	}
	recordExampleCases(
		{
			unitId: 'function.derive-manifest',
			symbol: 'deriveManifest',
			state: 'throws-typeerror-when-there-is-no-previous-manifest-and-file',
			evidence: 'examples-cases',
			file: 'throws-typeerror-when-there-is-no-previous-manifest-and-file.json'
		},
		[
			{
				name: 'empty source list without a previous manifest',
				input: { id: input.id, files: [] },
				error: { name: (error as Error).name }
			}
		]
	);
});

test('Throws ZodError when the assembled contract fails schema validation', () => {
	const input = sampleInput();
	input.files[0].exports[0].inputs = [{ name: 'broken', type: '' }];
	expect(() => deriveManifest(input)).toThrowError();
	let error: unknown;
	try {
		deriveManifest(input);
	} catch (caught) {
		error = caught;
	}
	recordExampleCases(
		{
			unitId: 'function.derive-manifest',
			symbol: 'deriveManifest',
			state: 'throws-zoderror-when-the-assembled-contract-fails-schema-val',
			evidence: 'examples-cases',
			file: 'throws-zoderror-when-the-assembled-contract-fails-schema-val.json'
		},
		[
			{
				name: 'source export has an invalid empty input type',
				input: { exportedInputType: '' },
				error: { name: (error as Error).name }
			}
		]
	);
});
