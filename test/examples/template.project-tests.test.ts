import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { appTestFiles } from '../../src/templates/projects-sessions/projectTests';

test('Appends the project smoke test', () => {
	const files = appTestFiles();
	const smokeTest = files.find((file) => file.path === 'test/smoke.test.ts');

	expect(smokeTest).toEqual({
		path: 'test/smoke.test.ts',
		contents:
			"import { expect, test } from 'vitest';\n\ntest('Harness app scaffold is ready', () => {\n\texpect(true).toBe(true);\n});\n"
	});
	recordExampleCases(
		{
			unitId: 'template.project-tests',
			symbol: 'appTestFiles',
			state: 'appends-the-project-smoke-test',
			evidence: 'examples-cases',
			file: 'appends-the-project-smoke-test.json'
		},
		[
			{
				name: 'scaffold output includes the ready smoke test',
				input: {},
				output: {
					path: 'test/smoke.test.ts',
					contents:
						"import { expect, test } from 'vitest';\n\ntest('Harness app scaffold is ready', () => {\n\texpect(true).toBe(true);\n});\n"
				}
			}
		]
	);
});
