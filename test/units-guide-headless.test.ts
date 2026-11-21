import { rm } from 'node:fs/promises';
import { afterEach, expect, test } from 'vitest';
import type { ScenarioManifest } from '../src/core/development-tooling/unitTypes';
import type { ExplorerCapture } from '../packages/reports/src/models/explorer-ui/ExplorerEvidence.types';
import type {
	GuidanceContext,
	GuideReport,
	StateRegistry
} from '../src/workflows/development-tooling/guide-units/guideUnits.types';
import {
	headlessOnly,
	headlessStateNames,
	namedUnitStates,
	scenarioStatesFor
} from '../src/workflows/development-tooling/guide-units/guidanceContext';
import {
	guideUnits,
	recordedDone,
	renderUnitsGuide
} from '../src/workflows/development-tooling/guide-units/guideUnits';
import {
	commitGuidance,
	entity,
	guidanceProject,
	writeGuidanceFile
} from './support/unitsGuidanceProject';

const unitId = 'component.alpha';
const roots: string[] = [];
afterEach(async () => {
	for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

function scenario(overrides: Partial<ScenarioManifest> = {}): ScenarioManifest {
	return {
		schemaVersion: 1,
		id: 'headless.coverage',
		title: 'Headless coverage',
		kind: 'headless',
		units: [unitId],
		states: [{ id: 'component-alpha-ready', title: 'Ready', coverage: 'required' }],
		viewports: [],
		tests: [{ id: 'unit.alpha', kind: 'unit', runner: 'vitest', target: 'test/alpha.test.ts' }],
		evidence: [
			{ id: 'assertions', kind: 'assertions', states: ['ready'], viewports: [], required: true }
		],
		...overrides
	};
}

test('scenarioStatesFor preserves unit attribution and named-state rules', () => {
	const specific = scenario({
		units: [unitId, 'component.beta'],
		states: [
			{ id: 'component-alpha-current', title: 'Current', coverage: 'required', units: [unitId] },
			{ id: 'shared-other', title: 'Other', coverage: 'required', units: ['component.beta'] },
			{ id: 'component-alpha-loading', title: 'Loading', coverage: 'required' }
		]
	});
	expect(scenarioStatesFor(specific, unitId).map((state) => state.id)).toEqual([
		'component-alpha-current'
	]);
	expect(scenarioStatesFor(specific, 'component.gamma')).toEqual([]);

	const named = scenario({
		units: [unitId, 'component.beta'],
		states: [
			{ id: 'component-alpha-loading', title: 'Loading', coverage: 'required' },
			{ id: 'component-beta-loading', title: 'Loading', coverage: 'required' },
			{ id: 'shared-current', title: 'Current', coverage: 'required' },
			{ id: 'component-alpha-unavailable', title: 'Unavailable', coverage: 'inapplicable' }
		]
	});
	expect(scenarioStatesFor(named, unitId).map((state) => state.id)).toEqual([
		'component-alpha-loading'
	]);
});

test('headlessStateNames keeps required viewport-free states without UI or registry overlap', () => {
	const headless = scenario({
		states: [
			{ id: 'component-alpha-ready', title: 'Ready', coverage: 'required' },
			{ id: 'component-alpha-ui', title: 'UI overlap', coverage: 'required' },
			{ id: 'component-alpha-registered', title: 'Registered', coverage: 'required' },
			{ id: 'component-alpha-missing', title: 'Missing', coverage: 'missing' }
		]
	});
	const ui = scenario({
		id: 'ui.coverage',
		kind: 'ui',
		viewports: [{ id: 'desktop', width: 1280, height: 800 }],
		states: [{ id: 'component-alpha-ui', title: 'UI overlap', coverage: 'required' }]
	});
	const headlessWithViewport = scenario({
		id: 'headless.with-viewport',
		viewports: [{ id: 'desktop', width: 1280, height: 800 }],
		states: [{ id: 'component-alpha-visual', title: 'Visual', coverage: 'required' }]
	});
	const audio = scenario({
		id: 'audio.coverage',
		kind: 'audio',
		states: [{ id: 'component-alpha-audio', title: 'Audio', coverage: 'required' }]
	});
	const registry: StateRegistry[] = [
		{ entity: unitId, where: 'catalog.json', kind: 'catalog', states: ['registered'] },
		{ entity: 'component.beta', where: 'other.json', kind: 'required-states', states: ['ready'] }
	];

	expect(headlessStateNames([headless, ui, headlessWithViewport, audio], unitId, registry)).toEqual(
		['ready']
	);
	expect(headlessOnly([headless, ui], unitId)).toBe(false);
	expect(headlessOnly([headless, audio], unitId)).toBe(true);
});

test('a unit without scenarios is not headless-only and keeps its implicit default', () => {
	const context = { registries: [], loaded: { scenarios: [] } } as unknown as GuidanceContext;
	const unit = { id: unitId } as Parameters<typeof namedUnitStates>[1];

	expect(headlessOnly([], unitId)).toBe(false);
	expect(namedUnitStates(context, unit)).toEqual([
		{ name: 'default', origin: 'REQUIRED', reasons: ['Default presentation.'] }
	]);
});

test('an empty guide does not report completion', () => {
	const report = {
		entity: unitId,
		commit: 'fixture',
		states: [],
		guesses: [],
		summary: { done: 0, missing: 0 },
		next: null,
		proof: { store: 'git', gap: null }
	} satisfies GuideReport;

	expect(renderUnitsGuide(report)).toContain('No required states');
	expect(renderUnitsGuide(report)).not.toContain('DONE');
});

function capture(
	overrides: Partial<Pick<ExplorerCapture, 'state' | 'usable'>> & {
		kind?: string;
		status?: 'passed' | 'failed';
	} = {}
): ExplorerCapture {
	const { kind = 'assertions', status = 'passed', ...rest } = overrides;
	return {
		scenario: 'headless.coverage',
		state: 'component-alpha-ready',
		capture: {
			evidence: 'assertions',
			kind,
			state: 'component-alpha-ready',
			status,
			path: 'captures/assertions.json',
			sha256: '0'.repeat(64),
			mediaType: 'application/json',
			capturedAt: '2026-11-14T00:00:00Z',
			media: null
		},
		standing: 'fresh',
		usable: true,
		current: true,
		inheritedFrom: null,
		...rest
	};
}

test('recordedDone accepts usable passed assertions or trace captures for the named state', () => {
	expect(recordedDone([capture()], unitId, 'ready')).toBe(true);
	expect(recordedDone([capture({ kind: 'trace' })], unitId, 'ready')).toBe(true);
	expect(
		recordedDone(
			[capture({ usable: false }), capture({ status: 'failed' }), capture({ kind: 'output' })],
			unitId,
			'ready'
		)
	).toBe(false);
	expect(recordedDone([capture()], unitId, 'loading')).toBe(false);
});

test('a unit with UI and headless states classifies each state on its own', async () => {
	const root = await guidanceProject(['default', 'loading']);
	roots.push(root);
	await writeGuidanceFile(
		root,
		'specification/scenarios/widget-recorded.json',
		JSON.stringify({
			schemaVersion: 1,
			id: 'widget-recorded',
			title: 'Widget recorded assertions',
			kind: 'headless',
			units: [entity],
			states: [
				{
					id: 'component-widget-recorded',
					title: 'Recorded',
					coverage: 'required',
					units: [entity]
				}
			],
			viewports: [],
			tests: [{ id: 'recorded', kind: 'unit', runner: 'vitest', target: 'tests/recorded.test.ts' }],
			evidence: [
				{
					id: 'assertions',
					kind: 'assertions',
					states: ['component-widget-recorded'],
					viewports: [],
					required: true
				}
			]
		})
	);
	await writeGuidanceFile(
		root,
		'tests/recorded.test.ts',
		"test('recorded', () => expect(true).toBe(true));"
	);
	await commitGuidance(root);

	const report = await guideUnits(entity, { root });
	const state = (name: string) => report.states.find((item) => item.name === name);
	expect(report.states.map((item) => item.name)).toEqual(['default', 'loading', 'recorded']);
	// A UI state keeps the device matrix and has no evidence.
	expect(state('loading')).toMatchObject({
		status: 'MISSING',
		viewports: { desktop: 'MISSING', tablet: 'MISSING', mobile: 'MISSING' }
	});
	expect(state('loading')).not.toHaveProperty('evidence');
	// The headless state has an evidence column (nothing recorded yet) and no devices.
	expect(state('recorded')).toMatchObject({
		status: 'MISSING',
		evidence: 'MISSING',
		tests: [{ file: 'tests/recorded.test.ts', viewports: [] }]
	});
	expect(state('recorded')?.viewports).toEqual({});
	expect(renderUnitsGuide(report)).toContain(
		'MISSING recorded [REQUIRED] test:tests/recorded.test.ts evidence:MISSING'
	);
});
