import { test } from 'vitest';
import {
	harnessRuleLimits,
	harnessRuleSummaries,
	harnessRuleSummariesFor
} from '../../src/rules/explorer-ui/catalog';
import type { HarnessRuleLimits } from '../../src/rules/explorer-ui/catalog.types';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

/**
 * The limits and summaries are imported from the file that defines them, not from the re-export in
 * src/rules/catalog.ts. Each state calls the real code with the limits a caller gives it; what was
 * given and what came back are recorded as the cases of its state.
 */
const unitId = 'function.catalog';
const evidence = 'examples-cases';
const guidance = 'Use harness info naming and the scaffold guide before naming a module.';
const closing =
	'Unsupported file types must appear in audit coverage instead of being skipped silently.';

const standardLimits = {
	maxFileLines: 220,
	maxFunctionLines: 55,
	maxClassLines: 120,
	maxMethodLines: 35,
	maxNestingDepth: 4,
	maxParameters: 4,
	maxComplexity: 10,
	maxClassesPerFile: 1
};
const suppliedLimits: HarnessRuleLimits = {
	maxFileLines: 180,
	maxFunctionLines: 40,
	maxClassLines: 100,
	maxMethodLines: 25,
	maxNestingDepth: 3,
	maxParameters: 3,
	maxComplexity: 8,
	maxClassesPerFile: 1
};
const standardLimitLines = [
	'Files stay at or below 220 lines.',
	'Functions stay at or below 55 lines.',
	'Classes stay at or below 120 lines.',
	'Methods stay at or below 35 lines.',
	'Nesting stays at or below 4 levels.',
	'Functions and methods take at most 4 parameters.',
	'Cyclomatic complexity stays at or below 10.',
	'Each file defines at most 1 class.'
];
const suppliedLimitLines = [
	'Files stay at or below 180 lines.',
	'Functions stay at or below 40 lines.',
	'Classes stay at or below 100 lines.',
	'Methods stay at or below 25 lines.',
	'Nesting stays at or below 3 levels.',
	'Functions and methods take at most 3 parameters.',
	'Cyclomatic complexity stays at or below 8.',
	'Each file defines at most 1 class.'
];

/** The number of lines, the eight limit lines and the last line: what a reader checks first. */
function summaryOf(lines: string[]) {
	return { lines: lines.length, limits: lines.slice(0, 8), last: lines[lines.length - 1] };
}

test('harnessRuleSummariesFor gives the standard rule sentences', () => {
	const summaries = harnessRuleSummariesFor(harnessRuleLimits);
	expect(summaries.slice(0, 8)).toEqual(standardLimitLines);
	expect(summaries[8]).toBe(guidance);
	expect(summaries[summaries.length - 1]).toBe(closing);
	recordExampleCases(
		{
			unitId,
			symbol: 'harnessRuleSummariesFor',
			state: 'harnessrulesummariesfor-gives-the-standard-rule-sentences',
			evidence,
			file: 'harnessrulesummariesfor-gives-the-standard-rule-sentences.json'
		},
		[
			{
				name: 'standard limits from harnessRuleLimits',
				input: { limits: harnessRuleLimits },
				output: summaryOf(summaries)
			}
		]
	);
});

test('harnessRuleSummariesFor prints supplied limits unchanged', () => {
	const summaries = harnessRuleSummariesFor(suppliedLimits);
	const standard = harnessRuleSummariesFor(harnessRuleLimits);
	expect(summaries.slice(0, 8)).toEqual(suppliedLimitLines);
	expect(summaries.slice(8)).toEqual(standard.slice(8));
	recordExampleCases(
		{
			unitId,
			symbol: 'harnessRuleSummariesFor',
			state: 'harnessrulesummariesfor-prints-supplied-limits-unchanged',
			evidence,
			file: 'harnessrulesummariesfor-prints-supplied-limits-unchanged.json'
		},
		[
			{
				name: 'limits of 180 lines, 40 function lines and 3 parameters',
				input: { limits: suppliedLimits },
				output: summaryOf(summaries)
			}
		]
	);
});

test('harnessRuleSummaries is the default text computed at load', () => {
	const standard = harnessRuleSummariesFor(harnessRuleLimits);
	const later = harnessRuleSummariesFor(suppliedLimits);
	expect(harnessRuleLimits).toEqual(standardLimits);
	expect(harnessRuleSummaries).toEqual(standard);
	expect(later.slice(0, 8)).toEqual(suppliedLimitLines);
	expect(harnessRuleSummaries.slice(0, 8)).toEqual(standardLimitLines);
	recordExampleCases(
		{
			unitId,
			symbol: 'harnessRuleSummaries',
			state: 'harnessrulesummaries-is-the-default-text-computed-at-load',
			evidence,
			file: 'harnessrulesummaries-is-the-default-text-computed-at-load.json'
		},
		[
			{
				name: 'standard limits used when the module loads',
				input: { limits: harnessRuleLimits },
				output: summaryOf(harnessRuleSummaries)
			},
			{
				name: 'exported harnessRuleLimits read by callers',
				input: { export: 'harnessRuleLimits' },
				output: harnessRuleLimits
			}
		]
	);
});
