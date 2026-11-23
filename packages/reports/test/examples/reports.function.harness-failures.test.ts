import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { harnessFailures } from '../../src/components/explorer-ui/harness-failures/harnessFailures';
import type { FailureCause, FailureSummary } from '../../src/utils/explorer-ui/harnessFailures';

test('Groups repeated failure causes and retains totals', () => {
	const repeated = [
		'reports.component.evidence-grid: no baseline recorded',
		'reports.component.run-timeline: no baseline recorded',
		'reports.component.coverage-badge: output differs from baseline'
	];
	const many = [
		'reports.component.evidence-grid: output differs from baseline',
		'reports.component.run-timeline: output differs at line 9',
		'reports.component.coverage-badge: no baseline recorded',
		'reports.component.release-notes: theme token is undefined',
		'reports.component.shell-header: fixture file not found',
		'reports.function.harness-failures: export is missing'
	];
	const summarized = harnessFailures(repeated) satisfies FailureSummary;
	const limited = harnessFailures(many) satisfies FailureSummary;
	const expected: FailureCause[] = [
		{
			text: 'no baseline recorded',
			count: 2,
			subjects: ['reports.component.evidence-grid', 'reports.component.run-timeline']
		},
		{
			text: 'reports.component.coverage-badge: output differs from baseline',
			count: 1,
			subjects: []
		}
	];

	expect(summarized).toEqual({ total: 3, plain: true, causes: expected, more: 0 });
	expect(limited).toEqual({
		total: 6,
		plain: false,
		causes: many.slice(0, 5).map((text) => ({ text, count: 1, subjects: [] })),
		more: 1
	});
	recordExampleCases(
		{
			unitId: 'reports.function.harness-failures',
			symbol: 'harnessFailures',
			state: 'groups-repeated-failure-causes-and-retains-totals',
			evidence: 'examples-cases',
			file: 'groups-repeated-failure-causes-and-retains-totals.json'
		},
		[
			{ name: 'two records share a baseline cause', input: repeated, output: summarized },
			{
				name: 'six distinct failures show five causes and retain total',
				input: many,
				output: limited
			}
		]
	);
});
