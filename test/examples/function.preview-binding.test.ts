import { test } from 'vitest';
import { previewBinding } from '../../src/utils/development-tooling/previewBinding';
import type { PreviewUnit } from '../../src/utils/development-tooling/previewBinding.types';
import type { ScenarioManifest } from '../../src/core/development-tooling/unitTypes.types';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

/**
 * previewBinding is called the way the registry gate and the unit listing call it: one visual unit
 * with the scenario manifests its preview may name. It reads no files and runs no program, so no
 * temporary folder is needed. What each call was given and what it returned is asserted and
 * recorded as the cases of its state.
 */
const unitId = 'function.preview-binding';
const symbol = 'previewBinding';
const evidenceId = 'examples-cases';

/** Records the cases of one state; the state id is also the name of its case file. */
function recordState(state: string, cases: Parameters<typeof recordExampleCases>[1]): void {
	recordExampleCases({ unitId, symbol, state, evidence: evidenceId, file: `${state}.json` }, cases);
}

const gridId = 'reports.component.evidence-grid';
const gridPreview = { scenario: 'reports.review', state: 'populated', viewport: 'desktop' };
/** The contract's example of a visual unit whose preview is declared. */
const grid: PreviewUnit = { id: gridId, scenarios: ['reports.review'], preview: gridPreview };
const gridUnpreviewed: PreviewUnit = { id: gridId, scenarios: ['reports.review'] };
/** The contract's example of a visual unit with no preview. */
const legend: PreviewUnit = { id: 'reports.component.legend', scenarios: ['reports.review'] };
/** The legend unit previewed on the grid's populated state, which does not show the legend. */
const legendPreviewed: PreviewUnit = { ...legend, preview: gridPreview };

/** The contract's example scenario: one populated state with a required desktop screenshot. */
const review: ScenarioManifest = {
	schemaVersion: 1,
	id: 'reports.review',
	title: 'Report review',
	kind: 'ui',
	units: [gridId],
	states: [
		{
			id: 'populated',
			title: 'Grid with evidence rows',
			coverage: 'required',
			units: [gridId]
		}
	],
	viewports: [{ id: 'desktop', width: 1440, height: 900 }],
	tests: [
		{
			id: 'reports.review.capture',
			kind: 'e2e',
			runner: 'playwright',
			target: 'e2e/reports/review.spec.ts'
		}
	],
	evidence: [
		{
			id: 'reports.review.shot',
			kind: 'screenshot',
			states: ['populated'],
			viewports: ['desktop'],
			required: true
		}
	]
};
/** The same scenario under another id, which no preview names. */
const archive: ScenarioManifest = { ...review, id: 'reports.archive', title: 'Report archive' };
/** A scenario whose populated state omits per-state units, so it keeps the scenario's units. */
const historical: ScenarioManifest = {
	...review,
	states: [{ id: 'populated', title: 'Grid with evidence rows', coverage: 'required' }]
};
/** The populated state is no longer marked as required coverage. */
const missingCoverage: ScenarioManifest = {
	...review,
	states: [{ ...review.states[0], coverage: 'missing' }]
};
/** The populated state's only evidence is an assertion, not a screenshot. */
const assertionsOnly: ScenarioManifest = {
	...review,
	evidence: [{ ...review.evidence[0], kind: 'assertions' }]
};
/** The review scenario with a legend state of its own, so some state names the legend. */
const withLegend: ScenarioManifest = {
	...review,
	units: [gridId, 'reports.component.legend'],
	states: [
		...review.states,
		{
			id: 'legend',
			title: 'Legend beside the grid',
			coverage: 'required',
			units: ['reports.component.legend']
		}
	]
};

/** The scenario fields previewBinding reads, so each recorded input shows what it was given. */
function readFields(scenarios: ScenarioManifest[]) {
	return scenarios.map(({ id, units, states, viewports, evidence }) => ({
		id,
		units,
		states,
		viewports,
		evidence
	}));
}

test('Returns no issues for a unit that declares no preview', () => {
	const declared = previewBinding(legend, [review]);
	const removed = previewBinding(gridUnpreviewed, [review]);
	expect(declared).toEqual([]);
	expect(removed).toEqual([]);
	recordState('returns-no-issues-for-a-unit-that-declares-no-preview', [
		{
			name: 'legend unit with no preview, checked against the review scenario',
			input: { unit: legend, scenarios: readFields([review]) },
			output: declared
		},
		{
			name: 'evidence grid whose preview was removed, checked against the review scenario',
			input: { unit: gridUnpreviewed, scenarios: readFields([review]) },
			output: removed
		}
	]);
});

test('Reports an unknown preview scenario', () => {
	const none = previewBinding(grid, []);
	const other = previewBinding(grid, [archive]);
	const message = ['reports.component.evidence-grid: unknown preview scenario reports.review'];
	expect(none).toEqual(message);
	expect(other).toEqual(message);
	recordState('reports-an-unknown-preview-scenario', [
		{ name: 'no scenario manifests supplied', input: { unit: grid, scenarios: [] }, output: none },
		{
			name: 'only a scenario with another id supplied',
			input: { unit: grid, scenarios: readFields([archive]) },
			output: other
		}
	]);
});

test('Reports a preview state that does not show the unit', () => {
	const undeclaredUnit: PreviewUnit = { ...grid, preview: { ...gridPreview, state: 'empty' } };
	const undeclared = previewBinding(undeclaredUnit, [review]);
	const otherUnit = previewBinding(legendPreviewed, [withLegend]);
	expect(undeclared).toEqual([
		'reports.component.evidence-grid: preview state empty does not show reports.component.evidence-grid'
	]);
	expect(otherUnit).toEqual([
		'reports.component.legend: preview state populated does not show reports.component.legend'
	]);
	recordState('reports-a-preview-state-that-does-not-show-the-unit', [
		{
			name: 'grid preview naming a state the scenario does not declare',
			input: { unit: undeclaredUnit, scenarios: readFields([review]) },
			output: undeclared
		},
		{
			name: 'legend preview naming the grid state, while the legend has its own state',
			input: { unit: legendPreviewed, scenarios: readFields([withLegend]) },
			output: otherUnit
		}
	]);
});

test('Reports a preview with no required screenshot', () => {
	const mobileUnit: PreviewUnit = { ...grid, preview: { ...gridPreview, viewport: 'mobile' } };
	const mobile = previewBinding(mobileUnit, [review]);
	const uncovered = previewBinding(grid, [missingCoverage]);
	const headless = previewBinding(grid, [assertionsOnly]);
	const desktop = [
		'reports.component.evidence-grid: preview state populated has no required screenshot at desktop'
	];
	expect(mobile).toEqual([
		'reports.component.evidence-grid: preview state populated has no required screenshot at mobile'
	]);
	expect(mobile).toHaveLength(1);
	expect(uncovered).toEqual(desktop);
	expect(headless).toEqual(desktop);
	recordState('reports-a-preview-with-no-required-screenshot', [
		{
			name: 'mobile viewport that the scenario does not declare',
			input: { unit: mobileUnit, scenarios: readFields([review]) },
			output: mobile
		},
		{
			name: 'populated state whose coverage is missing',
			input: { unit: grid, scenarios: readFields([missingCoverage]) },
			output: uncovered
		},
		{
			name: 'populated state whose only evidence is an assertion',
			input: { unit: grid, scenarios: readFields([assertionsOnly]) },
			output: headless
		}
	]);
});

test('Accepts a preview with a required screenshot', () => {
	const shot = previewBinding(grid, [review]);
	const withoutUnits = previewBinding(grid, [historical]);
	expect(shot).toEqual([]);
	expect(withoutUnits).toEqual([]);
	recordState('accepts-a-preview-with-a-required-screenshot', [
		{
			name: 'populated state with a required screenshot at the desktop viewport',
			input: { unit: grid, scenarios: readFields([review]) },
			output: shot
		},
		{
			name: 'populated state that names no units, kept under the scenario units',
			input: { unit: grid, scenarios: readFields([historical]) },
			output: withoutUnits
		}
	]);
});
