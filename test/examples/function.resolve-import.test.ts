import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { resolveImport } from '../../src/utils/development-tooling/resolveImport';
import type { ResolveContext } from '../../src/utils/development-tooling/resolveImport.types';
import type { SourceReference } from '../../src/utils/development-tooling/scanImports.types';
import type { ResolvedReference } from '../../src/core/development-tooling/sourceTypes';

const importingFile = 'src/utils/development-tooling/resolveImport.ts';
const context = {
	workspaceRoot: '',
	files: new Set([
		'src/utils/development-tooling/resolveImport.types.ts',
		'src/routes/api/reports/+server.ts'
	])
} satisfies ResolveContext;

const cases: Array<{
	name: string;
	input: { from: string; reference: SourceReference };
	output: ResolvedReference;
}> = [
	{
		name: 'relative type import resolves to tracked file',
		input: {
			from: importingFile,
			reference: { specifier: './resolveImport.types', via: 'import', typeOnly: true }
		},
		output: {
			via: 'import',
			typeOnly: true,
			path: 'src/utils/development-tooling/resolveImport.types.ts'
		}
	},
	{
		name: 'built-in package retains its runtime module name',
		input: {
			from: importingFile,
			reference: { specifier: 'node:fs/promises', via: 'import', typeOnly: false }
		},
		output: { via: 'import', typeOnly: false, external: 'node:fs/promises' }
	},
	{
		name: 'untracked relative import reports uncertainty',
		input: {
			from: importingFile,
			reference: { specifier: './missing', via: 'dynamic-import', typeOnly: false }
		},
		output: {
			via: 'dynamic-import',
			typeOnly: false,
			uncertain: { reason: 'unresolved-import', detail: './missing' }
		}
	}
];

test('Resolve imports to tracked files, externals, or uncertainty', () => {
	const results = cases.map(({ input }) => resolveImport(input.from, input.reference, context));
	expect(results).toEqual(cases.map(({ output }) => output));
	recordExampleCases(
		{
			unitId: 'function.resolve-import',
			symbol: 'resolveImport',
			state: 'resolve-imports-to-tracked-files-externals-or-uncertainty',
			evidence: 'examples-cases',
			file: 'resolve-imports-to-tracked-files-externals-or-uncertainty.json'
		},
		cases
	);
});
