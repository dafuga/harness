import { test } from 'vitest';
import { formatConfigFiles } from '../../src/templates/development-tooling/formatConfig';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

test('Returns the formatting configuration files in scaffold order', () => {
	const files = formatConfigFiles();
	expect(files.map(({ path }) => path)).toEqual([
		'.gitignore',
		'.prettierrc',
		'.prettierignore'
	]);
	expect(files[1]?.contents).toContain('"useTabs": true');
	const output = files.map(({ path, contents }) => ({ path, contents }));
	recordExampleCases(
		{
			unitId: 'template.format-config',
			symbol: 'formatConfigFiles',
			state: 'returns-the-formatting-configuration-files-in-scaffold-order',
			evidence: 'examples-cases',
			file: 'returns-the-formatting-configuration-files-in-scaffold-order.json'
		},
		[
			{
				name: 'formatting config scaffold output',
				input: {},
				output
			}
		]
	);
});
