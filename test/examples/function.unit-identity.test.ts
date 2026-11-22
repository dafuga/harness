import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { unitIdentity } from '../../src/utils/development-tooling/classify-path/unitIdentity';

test('Derives conventional identities from source and crate paths', () => {
	const cases = [
		{
			name: 'component path gets workspace prefix',
			input: { path: 'src/components/evidence-grid.svelte', workspace: 'reports' },
			output: unitIdentity('src/components/evidence-grid.svelte', 'reports')
		},
		{
			name: 'utility source path becomes a function identity',
			input: { path: 'src/utils/development-tooling/classify-path/unitIdentity.ts' },
			output: unitIdentity('src/utils/development-tooling/classify-path/unitIdentity.ts')
		},
		{
			name: 'crate manifest belongs to its kernel unit',
			input: { path: 'crates/harness-kernel/Cargo.toml' },
			output: unitIdentity('crates/harness-kernel/Cargo.toml')
		},
	];
	expect(cases.map(({ output }) => output)).toEqual([
		{ id: 'reports.component.evidence-grid', kind: 'component', name: 'evidence-grid' },
		{
			id: 'function.development-tooling-classify-path-unit-identity',
			kind: 'function',
			name: 'development-tooling-classify-path-unit-identity'
		},
		{ id: 'kernel.harness-kernel', kind: 'kernel', name: 'harness-kernel' }
	]);
	recordExampleCases(
		{
			unitId: 'function.unit-identity',
			symbol: 'unitIdentity',
			state: 'derives-conventional-identities-from-source-and-crate-paths',
			evidence: 'examples-cases',
			file: 'derives-conventional-identities-from-source-and-crate-paths.json'
		},
		cases
	);
});

test('Throws TypeError when a root folder path omits its folder', () => {
	const input = { path: 'scripts' };
	expect(() => unitIdentity(input.path)).toThrow(TypeError);
	const cases = [{
		name: 'root folder without a child path throws TypeError',
		input,
		error: 'TypeError'
	}];
	recordExampleCases(
		{
			unitId: 'function.unit-identity',
			symbol: 'unitIdentity',
			state: 'throws-typeerror-when-a-root-folder-path-omits-its-folder',
			evidence: 'examples-cases',
			file: 'throws-typeerror-when-a-root-folder-path-omits-its-folder.json'
		},
		cases
	);
});
