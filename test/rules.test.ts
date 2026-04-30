import { expect, test } from 'vitest';
import { harnessRuleLimits, harnessRuleSummaries } from '../src/rules/catalog';

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
