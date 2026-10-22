import { taskProfile } from './support/taskProfiles';
import { expect, test } from 'vitest';
import {
	harnessRuleLimits,
	harnessRuleSummaries,
	harnessRuleSummariesFor
} from '../src/rules/catalog';

test('Harness rule catalog defines Small Harness thresholds', () => {
	expect(harnessRuleLimits).toMatchObject({
		maxFileLines: 220,
		maxFunctionLines: 55,
		maxClassLines: 120,
		maxMethodLines: 35,
		maxNestingDepth: 4,
		maxParameters: 4,
		maxComplexity: 10,
		maxClassesPerFile: 1
	});
	expect(harnessRuleSummaries.length).toBeGreaterThan(8);
});

test('rule summaries describe the supplied limits rather than a cached default', async () => {
	const limits = { ...harnessRuleLimits, maxFileLines: 180 };
	expect(harnessRuleSummariesFor(limits)[0]).toBe('Files stay at or below 180 lines.');
	await taskProfile('function.catalog', 'describe-custom-audit-limits', () =>
		harnessRuleSummariesFor(limits)
	);
});
