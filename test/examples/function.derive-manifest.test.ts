import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import type { DeriveInput } from '../../src/utils/development-tooling/deriveManifest';
import { deriveManifest } from '../../src/workflows/development-tooling/load-units/unit-index-service/deriveManifest';

function sampleInput(): DeriveInput {
	return {
		id: 'function.derive-manifest',
		kind: 'function',
		files: [{
			path: 'src/utils/development-tooling/deriveManifest.ts', hash: 'fixture-hash',
			bytes: 120, lines: 8, language: 'typescript', classification: 'source',
			workspace: 'root', read: true, decisions: {}, references: [], blocks: [],
			exports: [{ name: 'deriveManifest', kind: 'function', inputs: [], output: 'ComponentManifest' }],
			errors: []
		}],
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
		operations: [{
			name: 'deriveManifest', inputs: [],
			outputs: [{ name: 'deriveManifest', type: 'ComponentManifest' }],
			errors: [], errorStatus: 'unknown'
		}]
	});
	recordExampleCases({
		unitId: 'function.derive-manifest', symbol: 'deriveManifest',
		state: 'derives-an-active-manifest-from-owned-source-facts',
		evidence: 'examples-cases', file: 'derives-an-active-manifest-from-owned-source-facts.json'
	}, [{
		name: 'one owned TypeScript source exports deriveManifest',
		input: { id: input.id, kind: input.kind, path: input.files[0].path },
		output
	}]);
});
