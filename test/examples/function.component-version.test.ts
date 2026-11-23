import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { componentVersion } from '../../src/utils/development-tooling/componentVersion';
import type { ComponentVersion } from '../../src/utils/development-tooling/componentVersion.types';

test('Fingerprints owned files and manifest parts', () => {
	const manifest = {
		schemaVersion: 1,
		id: 'function.component-version',
		uid: 'u_lvq6oinwwb',
		kind: 'function',
		title: 'Unit version identity',
		responsibility: 'Fingerprints unit manifest and owned source.',
		responsibilityOrigin: 'declared',
		status: 'active',
		owns: { source: ['src/b.ts', 'src/a.ts'], symbols: ['componentVersion'] },
		contract: {
			origin: 'declared',
			inputs: [],
			outputs: [],
			errors: [],
			errorStatus: 'none-found',
			operations: [],
			initialization: []
		},
		dependencies: [],
		runtime: {
			kind: 'module',
			entry: 'src/componentVersion.ts',
			targets: [{ kind: 'module', entry: 'src/componentVersion.ts' }]
		},
		scenarios: [],
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
	} satisfies Parameters<typeof componentVersion>[0];
	const files = new Map([
		['src/a.ts', { hash: 'hash-a' }],
		['src/b.ts', { hash: 'hash-b' }],
		['src/unowned.ts', { hash: 'ignored' }]
	]);
	const result: ComponentVersion = componentVersion(manifest, files);
	const input = { manifest, fileHashes: Object.fromEntries(files) };
	const cases = [
		{
			name: 'owned files are sorted and unrelated files are ignored',
			input,
			output: {
				unit: result.unit,
				manifest: result.manifest,
				source: result.source,
				contract: result.contract,
				runtime: result.runtime,
				files: result.files
			}
		}
	];
	expect(result.unit).toBe(manifest.id);
	expect(result.files).toEqual([
		{ path: 'src/a.ts', hash: 'hash-a' },
		{ path: 'src/b.ts', hash: 'hash-b' }
	]);
	expect(result.manifest).toMatch(/^[a-f0-9]{64}$/);
	expect(result.source).toMatch(/^[a-f0-9]{64}$/);
	recordExampleCases(
		{
			unitId: 'function.component-version',
			symbol: 'componentVersion',
			state: 'fingerprints-owned-files-and-manifest-parts',
			evidence: 'examples-cases',
			file: 'fingerprints-owned-files-and-manifest-parts.json'
		},
		cases
	);
});
