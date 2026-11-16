import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { standardCodeModules } from '../../src/templates/module-system/standardCodeModules';

test('Declares standard internal code modules', () => {
	expect(standardCodeModules).toHaveLength(12);
	expect(standardCodeModules.every((module) => module.includedByDefault && module.visibility === 'internal')).toBe(true);
	expect(standardCodeModules[0].resources[0].generator).toEqual({ kind: 'scaffold', scaffold: 'api' });

	const output = standardCodeModules.map((module) => ({
		id: module.id,
		title: module.title,
		order: module.order,
		resource: module.resources[0].id,
		catalog: module.resources[0].catalog,
		files: module.resources[0].files?.map(({ path }) => path) ?? [],
		generator: module.resources[0].generator ?? null
	}));
	recordExampleCases(
		{
			unitId: 'template.module-system-standard-code-modules',
			symbol: 'standardCodeModules',
			state: 'declares-standard-internal-code-modules',
			evidence: 'examples-cases',
			file: 'declares-standard-internal-code-modules.json'
		},
		[{ name: 'all twelve built-in Code capabilities and their generation destinations', input: {}, output }]
	);
});
