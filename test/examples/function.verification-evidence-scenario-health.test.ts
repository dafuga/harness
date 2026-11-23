import { test } from 'vitest';
import {
	scenarioHealth,
	renderScenarioHealth
} from '../../src/utils/verification-evidence/scenarioHealth';
import type { ScenarioHealthInput } from '../../src/utils/verification-evidence/scenarioHealth.types';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

function scenarioInput(): ScenarioHealthInput {
	return {
		scenarios: [
			{
				id: 'overview-desktop',
				units: ['reports.component.covered'],
				states: [{ coverage: 'required' }, { coverage: 'missing' }],
				viewports: [
					{ id: 'desktop', width: 1440, height: 900 },
					{ id: 'nav-phone', width: 390, height: 844 }
				]
			},
			{
				id: 'overview-tablet',
				units: ['reports.component.covered'],
				states: [{ coverage: 'inapplicable' }],
				viewports: [
					{ id: 'desktop', width: 1280, height: 800 },
					{ id: 'tablet', width: 800, height: 900 }
				]
			}
		],
		units: [
			{ id: 'reports.component.covered', kind: 'component', status: 'active' },
			{ id: 'reports.component.evidence-grid', kind: 'component', status: 'active' },
			{ id: 'reports.page.overview', kind: 'page', status: 'retired' },
			{ id: 'reports.service.orphan', kind: 'service', status: 'active' }
		]
	} as unknown as ScenarioHealthInput;
}

function expectedSummary() {
	return {
		scenarios: 2,
		unknown: [{ id: 'nav-phone', scenarios: ['overview-desktop'], canonical: 'mobile' }],
		conflicts: [
			{
				id: 'desktop',
				sizes: [
					{ width: 1280, height: 800, scenarios: ['overview-tablet'] },
					{ width: 1440, height: 900, scenarios: ['overview-desktop'] }
				]
			}
		],
		offPreset: [
			{
				scenario: 'overview-tablet',
				id: 'desktop',
				canonical: 'desktop',
				size: '1280x800',
				preset: '1440x900'
			},
			{
				scenario: 'overview-tablet',
				id: 'tablet',
				canonical: 'tablet',
				size: '800x900',
				preset: '920x800'
			}
		],
		coverage: { required: 1, missing: 1, inapplicable: 1 },
		noScenario: {
			total: 2,
			retired: 1,
			counts: { components: 1, pages: 0, other: 1 },
			components: ['reports.component.evidence-grid'],
			pages: [],
			other: ['reports.service.orphan'],
			byPrefix: { 'reports.component': 1 }
		}
	};
}

test('Reports viewport drift, state coverage, and uncovered units', () => {
	const input = scenarioInput();
	const health = scenarioHealth(input);
	const summary = {
		scenarios: health.scenarios,
		unknown: health.viewports.unknown,
		conflicts: health.viewports.conflicts,
		offPreset: health.viewports.offPreset,
		coverage: health.coverage,
		noScenario: health.noScenario
	};
	expect(summary).toEqual(expectedSummary());
	const render = renderScenarioHealth(health);
	expect(render).toContain('Viewport ids outside desktop|tablet|mobile: 1');
	expect(render).toContain(
		'State coverage: 1 required, 1 missing, 1 inapplicable (field `coverage` of each state).'
	);
	expect(render).toContain('  reports.component: 1');
	expect(render.join('\n')).not.toContain('reports.component.evidence-grid');

	const state = 'reports-viewport-drift-state-coverage-and-uncovered-units';
	recordExampleCases(
		{
			unitId: 'function.verification-evidence-scenario-health',
			symbol: 'scenarioHealth',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[{ name: 'summarizes scenario coverage and viewport health', input, output: summary }]
	);
	recordExampleCases(
		{
			unitId: 'function.verification-evidence-scenario-health',
			symbol: 'renderScenarioHealth',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[{ name: 'renders the report without uncovered unit ids', input: summary, output: render }]
	);
});
