import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { comparisonChoices, harnessComparison } from '../../src/components/explorer-ui/harness-compare-media/harnessComparison';
import type { ComparedSide, StateChoice } from '../../src/utils/explorer-ui/harnessComparison';

const capture = (viewport: string, kind = 'screenshot') => ({
	evidence: 'browser',
	kind,
	state: 'loaded',
	viewport,
	status: 'passed' as const,
	path: `captures/${viewport}.png`,
	sha256: 'a'.repeat(64),
	mediaType: kind === 'audio' ? 'audio/wav' : 'image/png',
	capturedAt: '2026-01-02T03:04:05.000Z',
	media: `bytes-${viewport}`
});

const side = (commit: string, id: string, captures: ReturnType<typeof capture>[]): ComparedSide => ({
	detail: {
		commit,
		registry: { available: true, units: [], scenarios: [], graph: { edges: [] } },
		comparison: null,
		records: [],
		explanations: []
	} as ComparedSide['detail'],
	record: {
		id,
		status: 'passed',
		valid: true,
		problems: [],
		failures: [],
		source: { commit, base: null },
		profile: 'example',
		startedAt: '2026-01-02T03:00:00.000Z',
		finishedAt: '2026-01-02T03:04:05.000Z',
		tests: [],
		measurements: [],
		budgets: { findings: [] },
		scenarios: [{
			id: 'checkout-summary',
			status: 'passed',
			testedRevision: commit,
			inherited: false,
			origin: { record: id, commit },
			states: [{ id: 'loaded', captures }]
		}]
	} as unknown as NonNullable<ComparedSide['record']>
});

const choice: StateChoice = { scenario: 'checkout-summary', state: 'loaded', viewport: '' };

test('Lists unique recorded media choices across both revisions', () => {
	const base = side('1111111111111111111111111111111111111111', 'record-before', [capture('desktop')]);
	const head = side('2222222222222222222222222222222222222222', 'record-after', [capture('mobile'), capture('desktop')]);
	const output = comparisonChoices(base, head);
	expect(output).toEqual([{ scenario: 'checkout-summary', states: ['loaded'], viewports: ['desktop', 'mobile'] }]);
	recordExampleCases(
		{ unitId: 'reports.function.harness-comparison', symbol: 'comparisonChoices', state: 'lists-unique-recorded-media-choices-across-both-revisions', evidence: 'examples-cases', file: 'lists-unique-recorded-media-choices-across-both-revisions.json' },
		[{ name: 'media choices are deduplicated and sorted across revisions', input: { base, head }, output }]
	);
});

test('Aligns matching captures and marks missing revision media', () => {
	const base = side('3333333333333333333333333333333333333333', 'record-before', [capture('desktop')]);
	const head = side('4444444444444444444444444444444444444444', 'record-after', [capture('mobile')]);
	const output = harnessComparison(base, head, choice);
	const summary = {
		items: output.items.map(({ phase, status, missing, viewport }) => ({ phase, status, missing, viewport })),
		aligned: output.aligned.map(({ label, before, after }) => ({ label, before, after }))
	};
	expect(summary.items).toHaveLength(4);
	expect(summary.items.filter((item) => item.missing)).toHaveLength(2);
	recordExampleCases(
		{ unitId: 'reports.function.harness-comparison', symbol: 'harnessComparison', state: 'aligns-matching-captures-and-marks-missing-revision-media', evidence: 'examples-cases', file: 'aligns-matching-captures-and-marks-missing-revision-media.json' },
		[{ name: 'nonmatching viewports produce explicit gaps on the opposite revision', input: { base, head, choice }, output: summary }]
	);
});
