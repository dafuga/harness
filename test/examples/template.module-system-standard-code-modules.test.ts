import { test, vi } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { standardCodeModules } from '../../src/templates/module-system/standardCodeModules';

test('Declares standard internal code modules', () => {
	expect(standardCodeModules).toHaveLength(12);
	expect(
		standardCodeModules.every(
			(module) => module.includedByDefault && module.visibility === 'internal'
		)
	).toBe(true);
	expect(standardCodeModules[0].resources[0].generator).toEqual({
		kind: 'scaffold',
		scaffold: 'api'
	});

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
		[
			{
				name: 'all twelve built-in Code capabilities and their generation destinations',
				input: {},
				output
			}
		]
	);
});

test('Throws UnknownStandardScaffoldError when a scaffold kind is unavailable', async () => {
	vi.resetModules();
	vi.doMock('../../src/templates/development-tooling/scaffoldTypes', () => ({ scaffoldKinds: [] }));
	try {
		const loadModules = () => import('../../src/templates/module-system/standardCodeModules');
		await expect(loadModules()).rejects.toMatchObject({
			name: 'UnknownStandardScaffoldError',
			message: 'Unknown standard scaffold.'
		});
		recordExampleCases(
			{
				unitId: 'template.module-system-standard-code-modules',
				symbol: 'standardCodeModules',
				state: 'throws-unknownstandardscaffolderror-when-a-scaffold-kind-is',
				evidence: 'examples-cases',
				file: 'throws-unknownstandardscaffolderror-when-a-scaffold-kind-is.json'
			},
			[
				{
					name: 'missing API scaffold mapping aborts module construction',
					input: {},
					error: 'UnknownStandardScaffoldError: Unknown standard scaffold.'
				}
			]
		);
	} finally {
		vi.doUnmock('../../src/templates/development-tooling/scaffoldTypes');
		vi.resetModules();
	}
});
