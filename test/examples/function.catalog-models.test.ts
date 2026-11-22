import { test } from 'vitest';
import { catalogModels } from '../../src/core/git-source-history/catalogModels';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const state = 'catalog-models-list-all-declared-query-catalog-models';
const modelNames = catalogModels.map((model) => model.name);

test('Catalog models list all declared query catalog models', () => {
	expect(modelNames).toEqual([
		'CatalogMetadata',
		'CatalogBranch',
		'CatalogRevision',
		'CatalogEntity',
		'CatalogRevisionEntity',
		'CatalogDependency',
		'CatalogRecord',
		'CatalogScenario'
	]);
	recordExampleCases(
		{
			unitId: 'function.catalog-models',
			symbol: 'catalogModels',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[
			{
				name: 'query catalog declares its eight model constructors in order',
				input: {},
				output: modelNames
			}
		]
	);
});
