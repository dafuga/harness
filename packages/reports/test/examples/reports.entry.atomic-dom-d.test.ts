import { fileURLToPath } from 'node:url';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

const declarationPath = fileURLToPath(
	new URL('../../src/lib/atoms/native-dom.d.ts', import.meta.url)
);

test('Loads the declaration file with no runtime exports', async () => {
	const loaded = (await import(declarationPath)) as Record<string, unknown>;
	const runtimeExports = Object.keys(loaded);
	expect(runtimeExports).toEqual([]);
	recordExampleCases(
		{
			unitId: 'reports.entry.atomic-dom-d',
			symbol: 'native-dom',
			state: 'loads-the-declaration-file-with-no-runtime-exports',
			evidence: 'examples-cases',
			file: 'loads-the-declaration-file-with-no-runtime-exports.json'
		},
		[
			{
				name: 'loads native-dom.d.ts without runtime values',
				input: 'native-dom.d.ts',
				output: { runtimeExports }
			}
		]
	);
});
