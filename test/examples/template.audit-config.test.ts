import { test } from 'vitest';
import { auditConfigFiles } from '../../src/templates/development-tooling/auditConfig';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

test('Generates the audit config file', () => {
	const files = auditConfigFiles();
	const file = files[0];
	const config = JSON.parse(file.contents) as {
		limits: unknown;
		ignore: unknown[];
		cleanCode: unknown;
	};

	expect(files).toHaveLength(1);
	expect(file.path).toBe('harness.audit.json');
	expect(config.ignore).toEqual([]);
	expect(file.contents).toMatch(/\n\t"limits":/);
	expect(file.contents.endsWith('\n')).toBe(true);
	recordExampleCases(
		{
			unitId: 'template.audit-config',
			symbol: 'auditConfigFiles',
			state: 'generates-the-audit-config-file',
			evidence: 'examples-cases',
			file: 'generates-the-audit-config-file.json'
		},
		[
			{
				name: 'the scaffold emits tab-indented audit settings with an empty ignore list',
				input: {},
				output: { path: file.path, contents: file.contents }
			}
		]
	);
});
