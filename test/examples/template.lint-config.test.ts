import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { lintConfigFiles } from '../../src/templates/development-tooling/lintConfig';

test('Plans the lint configuration files', () => {
	const files = lintConfigFiles();
	expect(files.map(({ path }) => path)).toEqual([
		'eslint.harness-rules.js',
		'eslint.config.js'
	]);
	expect(files[0].contents).toContain('maxFileLines: 220');
	expect(files[0].contents).toContain("'no-manager-name'");
	expect(files[1].contents).toContain("'@typescript-eslint/no-explicit-any': 'error'");
	expect(files[1].contents).toContain("max-classes-per-file");
	recordExampleCases(
		{
			unitId: 'template.lint-config',
			symbol: 'lintConfigFiles',
			state: 'plans-the-lint-configuration-files',
			evidence: 'examples-cases',
			file: 'plans-the-lint-configuration-files.json'
		},
		[
			{
				name: 'plans the plugin rules and ESLint config in stable order',
				input: {},
				output: files.map(({ path, contents }) => ({
					path,
					lines: contents.split('\n').length - 1,
					keyLines: contents
						.split('\n')
						.filter((line) => /maxFileLines: 220|no-manager-name|no-explicit-any|max-classes-per-file/.test(line))
				}))
			}
		]
	);
});
