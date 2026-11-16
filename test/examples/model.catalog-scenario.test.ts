import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { CatalogScenario } from '../../src/models/git-source-history/CatalogScenario';
import type {
	CatalogScenarioAttributes,
	CatalogScenarioCreateInput,
	CatalogScenarioUpdateInput
} from '../../src/models/git-source-history/CatalogScenario.types';

const row: CatalogScenarioAttributes = {
	id: 'catalog-scenario-checkout-001',
	scenarioId: 'checkout.happy-path',
	commit: 'a94b5c6d7e8f90123456789abcdef01234567890',
	title: 'Checkout happy path',
	data: {
		id: 'checkout.happy-path',
		title: 'Checkout happy path',
		kind: 'headless',
		units: ['model.catalog-scenario'],
		states: [{ id: 'baseline', title: 'Baseline', coverage: 'required' }],
		viewports: [],
		tests: [{ id: 'catalog-scenario.find.unit', kind: 'unit', runner: 'vitest' }],
		evidence: [{ id: 'catalog-scenario.find.assertions', kind: 'assertions', states: ['baseline'], viewports: [] }]
	}
};

function adapter(overrides: Record<string, unknown> = {}) {
	return {
		find: async () => row,
		findBy: async () => [row],
		create: async (_table: string, input: Record<string, unknown>) => input,
		update: async () => row,
		delete: async () => true,
		...overrides
	} as Parameters<typeof CatalogScenario.find>[0];
}

test('Finds a scenario row by its opaque id', async () => {
	const result = await CatalogScenario.find(adapter(), row.id);
	expect(result).toEqual(row);
	recordExampleCases({ unitId: 'model.catalog-scenario', symbol: 'find', state: 'finds-a-scenario-row-by-its-opaque-id', evidence: 'examples-cases', file: 'finds-a-scenario-row-by-its-opaque-id.json' }, [
		{ name: 'adapter returns the revision-bound scenario row', input: { id: row.id }, output: result }
	]);
});

test('Finds scenarios by a partial attribute filter', async () => {
	const result = await CatalogScenario.findBy(adapter(), { scenarioId: row.scenarioId });
	expect(result).toEqual([row]);
	recordExampleCases({ unitId: 'model.catalog-scenario', symbol: 'findBy', state: 'finds-scenarios-by-a-partial-attribute-filter', evidence: 'examples-cases', file: 'finds-scenarios-by-a-partial-attribute-filter.json' }, [
		{ name: 'adapter returns matching scenario rows', input: { scenarioId: row.scenarioId }, output: result }
	]);
});

test('Creates a scenario row from the complete input', async () => {
	const input: CatalogScenarioCreateInput = row;
	const result = await CatalogScenario.create(adapter(), input);
	expect(result).toEqual(row);
	recordExampleCases({ unitId: 'model.catalog-scenario', symbol: 'create', state: 'creates-a-scenario-row-from-the-complete-input', evidence: 'examples-cases', file: 'creates-a-scenario-row-from-the-complete-input.json' }, [
		{ name: 'adapter receives and returns the complete scenario row', input, output: result }
	]);
});

test('Updates a scenario title with a partial patch', async () => {
	const patch: CatalogScenarioUpdateInput = { title: 'Checkout completed' };
	const result = await CatalogScenario.update(adapter(), row.id, patch);
	expect(result).toEqual(row);
	recordExampleCases({ unitId: 'model.catalog-scenario', symbol: 'update', state: 'updates-a-scenario-title-with-a-partial-patch', evidence: 'examples-cases', file: 'updates-a-scenario-title-with-a-partial-patch.json' }, [
		{ name: 'adapter returns the updated scenario row', input: { id: row.id, patch }, output: result }
	]);
});

test('Deletes a scenario row and returns the adapter result', async () => {
	const result = await CatalogScenario.delete(adapter(), row.id);
	expect(result).toBe(true);
	recordExampleCases({ unitId: 'model.catalog-scenario', symbol: 'delete', state: 'deletes-a-scenario-row-and-returns-the-adapter-result', evidence: 'examples-cases', file: 'deletes-a-scenario-row-and-returns-the-adapter-result.json' }, [
		{ name: 'adapter confirms deletion', input: { id: row.id }, output: result }
	]);
});
