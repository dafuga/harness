import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import type { ScenarioManifest } from '../../../src/core/development-tooling/unitTypes';
import { scenarioHealth } from '../../../src/utils/verification-evidence/scenarioHealth';
import { checkScenarios } from '../../../src/cli/program/inspectScenarios';
const fixture = JSON.parse(
	readFileSync('specification/scenarios/component-catalog-previews.json', 'utf8')
) as ScenarioManifest;
// Initial report matrix: inventory/viewport diagnostics and the actual check boundary.
test('scenario health reports drift and missing active units without changing contracts', () => {
	const first = {
		...fixture,
		id: 'first',
		units: ['reports.component.card'],
		viewports: [{ id: 'phone', width: 390, height: 800 }],
		states: [{ ...fixture.states[0], coverage: 'required' as const }]
	};
	const second = { ...first, id: 'second', viewports: [{ id: 'phone', width: 400, height: 800 }] };
	const health = scenarioHealth({
		scenarios: [first, second],
		units: [
			{ id: 'reports.component.card', kind: 'component', status: 'active' },
			{ id: 'desktop.page.projects', kind: 'page', status: 'active' },
			{ id: 'reports.component.old', kind: 'component', status: 'retired' }
		]
	});
	expect(health.viewports.unknown).toEqual([{ id: 'phone', scenarios: ['first', 'second'] }]);
	expect(health.viewports.conflicts[0].sizes).toHaveLength(2);
	expect(health.noScenario).toMatchObject({
		total: 1,
		retired: 1,
		pages: ['desktop.page.projects'],
		components: []
	});
	expect(health.coverage.required).toBe(2);
	expect(scenarioHealth({ scenarios: [], units: [] }).noScenario.total).toBe(0);
});
test('scenario checking includes report-only diagnostics beside its validation outcome', async () => {
	const checked = await checkScenarios();
	expect(Object.hasOwn(checked, 'health')).toBe(true);
	expect(checked.errors).toEqual([]);
});
