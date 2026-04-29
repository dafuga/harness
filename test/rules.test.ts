import { expect, test } from 'vitest';
import { frameRuleLimits, frameRuleSummaries } from '../src/rules/catalog';

test('Frame rule catalog defines Small Frame thresholds', () => {
	expect(frameRuleLimits).toMatchObject({
		maxFileLines: 220,
		maxFunctionLines: 55,
		maxClassLines: 120,
		maxMethodLines: 35,
		maxNestingDepth: 4,
		maxParameters: 4,
		maxComplexity: 10,
		maxClassesPerFile: 1
	});
	expect(frameRuleSummaries.length).toBeGreaterThan(8);
});
