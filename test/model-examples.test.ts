import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { componentManifestSchema } from '../src/core/unitTypes';
import { modelExampleCases } from './support/modelExamples';

const root = process.cwd();

function readUnit(unitId: string) {
	return componentManifestSchema.parse(
		JSON.parse(readFileSync(resolve(root, 'specification/units', `${unitId}.json`), 'utf8'))
	);
}

test('model.catalog-branch examples are checked against runtime fields', async () => {
	const unit = readUnit('model.catalog-branch');
	unit.contract.inputs[0].examples = ['abc', 42];

	const result = await modelExampleCases(unit, root);

	expect(result).toMatchObject({
		schema: { fields: { id: { type: 'string' }, head: { type: 'string' } } },
		cases: [
			{ name: 'CatalogBranch.id', fieldName: 'id', example: 'abc', valid: true },
			{
				name: 'CatalogBranch.id',
				fieldName: 'id',
				example: 42,
				valid: false,
				reason: 'example type does not match string'
			}
		]
	});
});

test('desktop.model.desktop-types has no runtime schema', async () => {
	expect(await modelExampleCases(readUnit('desktop.model.desktop-types'), root)).toEqual({
		schema: null,
		reason: 'no runtime schema'
	});
});
