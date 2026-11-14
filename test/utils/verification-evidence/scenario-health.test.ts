import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import type { ScenarioManifest } from '../../../src/core/development-tooling/unitTypes';
import {
	renderScenarioHealth,
	scenarioHealth
} from '../../../src/utils/verification-evidence/scenarioHealth';
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
	expect(health.viewports.unknown).toEqual([
		{ id: 'phone', scenarios: ['first', 'second'], canonical: 'mobile' }
	]);
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
test('viewports are compared with the canonical presets after aliases, warn-only', () => {
	const scenario = {
		...fixture,
		id: 'presets',
		viewports: [
			{ id: 'desktop', width: 1440, height: 900 },
			{ id: 'tablet', width: 768, height: 900 },
			{ id: 'nav-phone', width: 390, height: 900 },
			{ id: 'kiosk', width: 1080, height: 1920 }
		]
	};
	const health = scenarioHealth({ scenarios: [scenario], units: [] });
	expect(health.viewports.offPreset).toEqual([
		{
			scenario: 'presets',
			id: 'nav-phone',
			canonical: 'mobile',
			size: '390x900',
			preset: '390x844'
		},
		{ scenario: 'presets', id: 'tablet', canonical: 'tablet', size: '768x900', preset: '920x800' }
	]);
	expect(health.viewports.unknown.find((item) => item.id === 'kiosk')?.canonical).toBeNull();
	const lines = renderScenarioHealth(health).join('\n');
	expect(lines).toContain('nav-phone (alias of mobile)');
	expect(lines).toContain(
		'Warning (canonical presets desktop 1440x900, tablet 920x800, mobile 390x844): 2'
	);
});
test('scenario checking includes report-only diagnostics beside its validation outcome', async () => {
	const checked = await checkScenarios();
	expect(Object.hasOwn(checked, 'health')).toBe(true);
	expect(checked.errors).toEqual([]);
});
