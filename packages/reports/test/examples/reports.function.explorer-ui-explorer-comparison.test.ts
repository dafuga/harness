import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	covering,
	united,
	merged,
	explorerComparison
} from '../../src/utils/explorer-ui/explorerComparison';

const unit = 'reports.component.evidence-grid';
const current = {
	id: 'evidence-grid-smoke',
	title: 'Evidence grid',
	kind: 'ui',
	units: [unit],
	states: [
		{ id: 'review', title: 'Grid with captures', coverage: 'required', reason: '', units: [unit] }
	],
	viewports: [{ id: 'desktop', width: 1280, height: 800 }],
	tests: [{ id: 'evidence-grid.e2e', kind: 'e2e', runner: 'playwright' }],
	evidence: [
		{
			id: 'evidence-grid-review-current',
			kind: 'screenshot',
			states: ['review'],
			viewports: ['desktop']
		}
	]
};
const beforeSide = {
	commit: '7f3a9c2d1b6e4a8f0c5d2e7a9b1c6d4e8f0a3b5c',
	detail: null,
	record: null,
	captures: [],
	coverage: [],
	gap: null
};
const afterSide = { ...beforeSide };

test('Compares evidence scenarios across revisions', () => {
	const unitedEntries = united(
		[{ id: 'evidence-grid-smoke' }, { id: 'evidence-grid-smoke' }],
		[
			{ id: 'evidence-grid-smoke' },
			{ id: 'evidence-grid-regression' },
			{ id: 'evidence-grid-regression' }
		]
	);
	const mergedScenario = merged(current, undefined);
	const differences = explorerComparison(beforeSide, afterSide, unit);
	const noRevisionScenarios = covering(null, unit);

	expect(unitedEntries.map((item) => item.id)).toEqual([
		'evidence-grid-smoke',
		'evidence-grid-smoke',
		'evidence-grid-regression',
		'evidence-grid-regression'
	]);
	expect(mergedScenario).toEqual(current);
	expect(differences).toEqual([]);
	expect(noRevisionScenarios).toEqual([]);
	recordExampleCases(
		{
			unitId: 'reports.function.explorer-ui-explorer-comparison',
			symbol: 'explorerComparison',
			state: 'compares-evidence-scenarios-across-revisions',
			evidence: 'examples-cases',
			file: 'compares-evidence-scenarios-across-revisions.json'
		},
		[
			{
				name: 'keeps first entries and repeated prior-only ids',
				input: {
					now: [{ id: 'evidence-grid-smoke' }, { id: 'evidence-grid-smoke' }],
					was: [
						{ id: 'evidence-grid-smoke' },
						{ id: 'evidence-grid-regression' },
						{ id: 'evidence-grid-regression' }
					]
				},
				output: unitedEntries.map((item) => item.id)
			},
			{
				name: 'returns current scenario when no prior declaration exists',
				input: { now: current, was: undefined },
				output: {
					id: mergedScenario.id,
					states: mergedScenario.states.map((state) => state.id),
					viewports: mergedScenario.viewports.map((viewport) => viewport.id)
				}
			},
			{
				name: 'reports profile difference and null coverage is empty',
				input: { before: beforeSide, after: afterSide, unit, detail: null },
				output: { reasons: differences, scenarios: noRevisionScenarios }
			}
		]
	);
});
