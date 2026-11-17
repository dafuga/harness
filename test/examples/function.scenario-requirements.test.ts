import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { scenarioRequirements } from '../../src/utils/verification-evidence/scenarioRequirements';

type Manifest = Parameters<typeof scenarioRequirements>[0];

const activityList = {
	schemaVersion: 1,
	id: 'activity-list-states',
	title: 'Activity List supported states',
	kind: 'ui',
	units: ['reports.component.activity-list'],
	states: [
		{ id: 'collapsed', title: 'Collapsed list', coverage: 'required' },
		{ id: 'expanded', title: 'Expanded list', coverage: 'required' },
		{
			id: 'error',
			title: 'Caller-supplied error row',
			coverage: 'missing',
			reason: 'No fixture renders the caller-supplied error row yet.'
		},
		{
			id: 'right-to-left',
			title: 'Right-to-left layout',
			coverage: 'inapplicable',
			reason: 'The shell is left-to-right only.'
		}
	],
	viewports: [
		{ id: 'desktop', width: 1440, height: 900 },
		{ id: 'mobile', width: 390, height: 844 }
	],
	tests: [
		{
			id: 'states',
			kind: 'e2e',
			runner: 'command',
			target: 'bun x playwright test --config src/configs/shellPlaywrightConfig.ts explorer-shell-activity-list.spec.ts',
			cwd: 'packages/reports'
		}
	],
	evidence: [
		{
			id: 'screens',
			kind: 'screenshot',
			states: ['collapsed', 'expanded', 'error'],
			viewports: ['desktop', 'mobile'],
			provenance: 'actual-capture',
			build: 'shell-fixture',
			capture: 'element',
			required: true
		}
	]
} satisfies Manifest;

const functionExamples = {
	schemaVersion: 1,
	id: 'function-examples',
	title: 'Recorded calls of a real function',
	kind: 'headless',
	units: ['desktop.function.compose-modes'],
	states: [
		{
			id: 'compose-modes',
			title: 'composeModes called for four project kinds',
			coverage: 'required'
		}
	],
	viewports: [],
	tests: [
		{
			id: 'compose-modes-cases',
			kind: 'integration',
			runner: 'command',
			target: 'bun ../../test/verification-output.ts vitest test/compose-modes-cases.test.ts',
			cwd: 'packages/desktop',
			timeoutMs: 180000
		}
	],
	evidence: [
		{
			id: 'function-examples-output',
			kind: 'output',
			states: ['compose-modes'],
			viewports: [],
			required: true
		},
		{
			id: 'function-examples-assertions',
			kind: 'assertions',
			states: ['compose-modes'],
			viewports: [],
			required: true
		}
	]
} satisfies Manifest;

test('Expands required evidence per state and viewport', () => {
	const result = scenarioRequirements(activityList);

	expect(result).toEqual({
		required: [
			{ evidence: 'screens', kind: 'screenshot', state: 'collapsed', viewport: 'desktop' },
			{ evidence: 'screens', kind: 'screenshot', state: 'collapsed', viewport: 'mobile' },
			{ evidence: 'screens', kind: 'screenshot', state: 'expanded', viewport: 'desktop' },
			{ evidence: 'screens', kind: 'screenshot', state: 'expanded', viewport: 'mobile' }
		],
		unproven: [
			{ state: 'error', reason: 'No fixture renders the caller-supplied error row yet.' }
		],
		excluded: [{ state: 'right-to-left', reason: 'The shell is left-to-right only.' }]
	});
	recordExampleCases(
		{
			unitId: 'function.scenario-requirements',
			symbol: 'scenarioRequirements',
			state: 'expands-required-evidence-per-state-and-viewport',
			evidence: 'examples-cases',
			file: 'expands-required-evidence-per-state-and-viewport.json'
		},
		[
			{
				name: 'activity list with two viewports, one missing and one inapplicable state',
				input: activityList,
				output: result
			}
		]
	);
});

test('Emits one capture per state when no viewports are named', () => {
	const result = scenarioRequirements(functionExamples);

	expect(result.required).toEqual([
		{ evidence: 'function-examples-output', kind: 'output', state: 'compose-modes' },
		{ evidence: 'function-examples-assertions', kind: 'assertions', state: 'compose-modes' }
	]);
	expect(result.unproven).toEqual([]);
	expect(result.excluded).toEqual([]);
	recordExampleCases(
		{
			unitId: 'function.scenario-requirements',
			symbol: 'scenarioRequirements',
			state: 'emits-one-capture-per-state-when-no-viewports-are-named',
			evidence: 'examples-cases',
			file: 'emits-one-capture-per-state-when-no-viewports-are-named.json'
		},
		[
			{
				name: 'headless function examples with output and assertions evidence',
				input: functionExamples,
				output: result
			}
		]
	);
});

test('Drops evidence that is not marked required', () => {
	const optional = {
		...activityList,
		evidence: [{ ...activityList.evidence[0], required: false }]
	} satisfies Manifest;
	const result = scenarioRequirements(optional);

	expect(result.required).toEqual([]);
	expect(result.unproven).toEqual([
		{ state: 'error', reason: 'No fixture renders the caller-supplied error row yet.' }
	]);
	expect(result.excluded).toEqual([{ state: 'right-to-left', reason: 'The shell is left-to-right only.' }]);
	recordExampleCases(
		{
			unitId: 'function.scenario-requirements',
			symbol: 'scenarioRequirements',
			state: 'drops-evidence-that-is-not-marked-required',
			evidence: 'examples-cases',
			file: 'drops-evidence-that-is-not-marked-required.json'
		},
		[
			{
				name: 'screenshot evidence with required set to false yields no captures',
				input: optional,
				output: result
			}
		]
	);
});
