import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { browserTestFiles } from '../../src/templates/development-tooling/browserTest';

const expectedPaths = [
	'tests/e2e/support/browserTest.ts',
	'tests/e2e/support/browserTest.types.ts'
];

function exportLines(contents: string): string[] {
	return contents.split('\n').filter((line) => line.startsWith('export'));
}

test('Plans the browser-test scaffold files in order', () => {
	const files = browserTestFiles();
	expect(files.map((file) => file.path)).toEqual(expectedPaths);
	expect(files[0]?.contents).toContain('export const test = base.extend<');
	expect(files[0]?.contents).toContain('export function browserErrorCollector(');
	expect(files[1]?.contents).toContain('export type DiagnosticInfo');
	expect(browserTestFiles()).toEqual(files);
	recordExampleCases(
		{
			unitId: 'template.browser-test',
			symbol: 'browserTestFiles',
			state: 'plans-the-browser-test-scaffold-files-in-order',
			evidence: 'examples-cases',
			file: 'plans-the-browser-test-scaffold-files-in-order.json'
		},
		[
			{
				name: 'browserTestFiles plans the two scaffold files in fixed order',
				input: {},
				output: {
					paths: files.map((file) => file.path),
					exportLines: files.map((file) => exportLines(file.contents))
				}
			}
		]
	);
});
