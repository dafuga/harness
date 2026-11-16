import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { sourceFileParts } from '../../src/components/explorer-ui/sourceFileParts';
import type { SourceFileParts } from '../../src/components/explorer-ui/sourceFileParts.types';

test('Splits source paths after removing an exact prefix', () => {
	const examples = [
		{
			name: 'source path relative to its package',
			input: {
				path: 'packages/reports/src/components/explorer-ui/sourceFileParts.ts',
				relativeTo: 'packages/reports/src/'
			}
		},
		{
			name: 'source path relative to its component folder',
			input: {
				path: 'packages/reports/src/components/explorer-ui/sourceFileParts.types.ts',
				relativeTo: 'packages/reports/src/components/explorer-ui/'
			}
		},
		{
			name: 'path retained when prefix does not match exactly',
			input: {
				path: 'packages/reports/src/components/explorer-ui/sourceFileParts.ts',
				relativeTo: 'Packages/reports/src/'
			}
		}
	];
	const cases = examples.map(({ name, input }) => {
		const output = sourceFileParts(input.path, input.relativeTo) satisfies SourceFileParts;
		return { name, input, output };
	});

	expect(cases.map(({ output }) => output)).toEqual([
		{ folder: 'components/explorer-ui', name: 'sourceFileParts.ts' },
		{ folder: '', name: 'sourceFileParts.types.ts' },
		{ folder: 'packages/reports/src/components/explorer-ui', name: 'sourceFileParts.ts' }
	]);
	recordExampleCases(
		{
			unitId: 'reports.function.explorer-ui-source-file-parts',
			symbol: 'sourceFileParts',
			state: 'splits-source-paths-after-removing-an-exact-prefix',
			evidence: 'examples-cases',
			file: 'splits-source-paths-after-removing-an-exact-prefix.json'
		},
		cases
	);
});
