import { expect, test } from 'vitest';
import type { ScenarioManifest } from '../src/core/development-tooling/unitTypes';
import type { ExplorerCapture } from '../packages/reports/src/models/explorer-ui/ExplorerEvidence.types';
import type { StateRegistry } from '../src/workflows/development-tooling/guide-units/guideUnits.types';
import {
	headlessOnly,
	headlessStateNames,
	scenarioStatesFor
} from '../src/workflows/development-tooling/guide-units/guidanceContext';
import { recordedDone } from '../src/workflows/development-tooling/guide-units/guideUnits';

const unitId = 'component.alpha';

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

	expect(headlessStateNames([headless, ui, headlessWithViewport, audio], unitId, registry)).toEqual([
		'ready'
	]);
	expect(headlessOnly([headless, ui], unitId)).toBe(false);
	expect(headlessOnly([headless, audio], unitId)).toBe(true);
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
			[
				capture({ usable: false }),
				capture({ status: 'failed' }),
				capture({ kind: 'output' })
			],
			unitId,
			'ready'
		)
	).toBe(false);
	expect(recordedDone([capture()], unitId, 'loading')).toBe(false);
});
