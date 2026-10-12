import { expect, test } from 'vitest';
import { scenarioManifestSchema } from '../../src/core/unitTypes';
import { revisionRegistry } from '../../src/utils/revisionRegistry';
import { ScenarioManifestValidator } from '../../src/validators/ScenarioManifestValidator';

const scenario = (states: object[]) =>
	scenarioManifestSchema.parse({
		schemaVersion: 1,
		id: 'explorer',
		title: 'Explorer',
		kind: 'ui',
		units: ['page.functions', 'page.function', 'function.route'],
		states,
		viewports: [{ id: 'desktop', width: 1440, height: 900 }],
		tests: [{ id: 'flow', kind: 'e2e', runner: 'playwright', target: 'tests/e2e/flow.spec.ts' }],
		evidence: [
			{
				id: 'screens',
				kind: 'screenshot',
				states: ['catalog'],
				viewports: ['desktop'],
				required: true
			}
		]
	});

test('a state may name the units it shows, and the stored registry keeps what it names', () => {
	const declared = scenario([
		{ id: 'catalog', title: 'Catalog', coverage: 'required', units: ['page.functions'] },
		{ id: 'entity', title: 'Entity', coverage: 'required', units: ['page.function'] }
	]);
	const [stored] = revisionRegistry([], [declared]).scenarios;
	expect(stored.states).toEqual([
		{ id: 'catalog', coverage: 'required', units: ['page.functions'] },
		{ id: 'entity', coverage: 'required', units: ['page.function'] }
	]);
});

test('a state that names no unit is stored as before, and a unit outside the scenario is refused', () => {
	const plain = scenario([{ id: 'catalog', title: 'Catalog', coverage: 'required' }]);
	expect(revisionRegistry([], [plain]).scenarios[0].states).toEqual([
		{ id: 'catalog', coverage: 'required' }
	]);
	const foreign = scenario([
		{ id: 'catalog', title: 'Catalog', coverage: 'required', units: ['page.other'] }
	]);
	expect(new ScenarioManifestValidator().validate(foreign, 'explorer.json').errors).toEqual([
		'explorer: state catalog shows page.other, which the scenario does not cover'
	]);
});
