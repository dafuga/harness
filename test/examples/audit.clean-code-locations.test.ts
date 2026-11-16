import { test } from 'vitest';
import {
	applyReviewLocations,
	planReviewLocations
} from '../../src/audit/development-tooling/cleanCodeLocations';
import type { LocationPlan } from '../../src/audit/development-tooling/cleanCodeLocations.types';
import type { PrincipleAssessment } from '../../src/audit/development-tooling/cleanCodeTypes';
import type { JevEvaluation } from '../../src/core/agents-providers/jevTypes';
import { maxReviewStateBytes } from '../../src/audit/verification-evidence/cleanCodeSnapshot';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

/**
 * The unit reads no files: callers pass source text, so no temporary folder is needed. Realistic
 * inputs are the contract's examples. Generated stress inputs (long lines, many spans) are recorded
 * as a description of the text, not as the text itself.
 */

const excerpt =
	"import { readFileSync, writeFileSync } from 'node:fs';\n\nexport function loadSettings(path: string) {\n\tconst settings = JSON.parse(readFileSync(path, 'utf8'));\n\twriteFileSync(`${path}.bak`, JSON.stringify(settings));\n\treturn settings;\n}";
const loadCode = `${excerpt}\n`;
const timeoutCode = 'export const DEFAULT_TIMEOUT_MS = 5000;\n';
const wideLine = 'x'.repeat(120);
const emptyPlan: LocationPlan = { spans: {}, questions: {} };

const sideEffects: PrincipleAssessment = {
	type: 'choice',
	choice: 'violates',
	confidence: 0.93,
	probabilities: { meets: 0.03, violates: 0.93, not_applicable: 0.02, insufficient_context: 0.02 },
	principle: 'side-effects',
	title: 'Explicit side effects',
	guidance:
		'Make side effects explicit in names and contracts; ordinary UI event handlers and command operations may mutate.',
	status: 'violates'
};
const meaningfulNames: PrincipleAssessment = {
	type: 'choice',
	choice: 'meets',
	confidence: 0.9,
	probabilities: { meets: 0.9, violates: 0.05, not_applicable: 0.02, insufficient_context: 0.03 },
	principle: 'meaningful-names',
	title: 'Meaningful names',
	guidance:
		'Name identifiers after their domain purpose; retain conventional framework and short local names when clear.',
	status: 'meets'
};
const asyncBoundaries: PrincipleAssessment = {
	type: 'choice',
	choice: 'not_applicable',
	confidence: 0.95,
	probabilities: { meets: 0.01, violates: 0.01, not_applicable: 0.95, insufficient_context: 0.03 },
	principle: 'async-boundaries',
	title: 'Clear asynchronous behavior',
	guidance:
		'Make completion, cancellation and shared-state ownership explicit where concurrent behavior exists.',
	status: 'not-applicable'
};
const focusedFunctions: PrincipleAssessment = {
	type: 'choice',
	choice: 'violates',
	confidence: 0.62,
	probabilities: { meets: 0.2, violates: 0.62, not_applicable: 0.05, insufficient_context: 0.13 },
	principle: 'focused-functions',
	title: 'Focused functions',
	guidance:
		'Extract independent tasks into clearly named functions without fragmenting an already coherent operation.',
	status: 'needs-review'
};
const violatingFocus: PrincipleAssessment = { ...focusedFunctions, status: 'violates' };
const loadAssessments = [sideEffects, meaningfulNames, asyncBoundaries];
const moduleAssessments = [sideEffects, meaningfulNames, violatingFocus];

const fresh = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function moduleSource(lines: number): string {
	const body = Array.from({ length: lines }, (_, i) => `export const option${i + 1} = ${i + 1};`);
	return `${body.join('\n')}\n`;
}

function spansOf(count: number, line: string): string {
	return `${Array.from({ length: count * 40 }, () => line).join('\n')}\n`;
}

/** The fields a reviewer reads: each span's line range and each question's criteria keys. */
function outline(plan: LocationPlan) {
	const spans = Object.entries(plan.spans).map(([id, s]) => [id, [s.startLine, s.endLine]]);
	const questions = Object.entries(plan.questions).map(([id, q]) => [id, Object.keys(q.criteria)]);
	return { spans: Object.fromEntries(spans), questions: Object.fromEntries(questions) };
}

function located(assessments: PrincipleAssessment[]) {
	return assessments.map(({ principle, location }) => ({
		principle,
		location: location ? { startLine: location.startLine, endLine: location.endLine } : null
	}));
}

/** A localization pass answering the side-effects question; the other span gets the remainder. */
function localization(choice: 'span-1' | 'file_wide', confidence: number): JevEvaluation {
	const other = choice === 'span-1' ? 'file_wide' : 'span-1';
	const probabilities = { [choice]: confidence, [other]: Number((1 - confidence).toFixed(2)) };
	return {
		model: 'jev-1.13.0',
		answers: { 'side-effects': { type: 'choice', choice, confidence, probabilities } },
		usage: { input_tokens: 3120, output_tokens: 46 }
	};
}

/** Applies a localization to fresh assessments; the input is the state before the call. */
function applied(plan: LocationPlan, result: JevEvaluation | undefined, minConfidence: number) {
	const assessments = fresh(loadAssessments);
	const input = { assessments: fresh(assessments), plan, result: result ?? null, minConfidence };
	applyReviewLocations(assessments, plan, result, minConfidence);
	return { input, output: located(assessments), assessments };
}

test('planReviewLocations groups source into 40-line spans, one question per violation', () => {
	const loadInput = { code: loadCode, assessments: loadAssessments };
	const timeoutInput = { code: timeoutCode, assessments: [focusedFunctions] };
	const moduleInput = { code: moduleSource(85), assessments: moduleAssessments };
	const loaded = planReviewLocations(loadInput.code, loadInput.assessments);
	const timeout = planReviewLocations(timeoutInput.code, timeoutInput.assessments);
	const modules = planReviewLocations(moduleInput.code, moduleInput.assessments);
	recordExampleCases(
		{
			unitId: 'audit.clean-code-locations',
			symbol: 'planReviewLocations',
			state: 'planreviewlocations-groups-source-into-40-line-spans-one-que',
			evidence: 'examples-cases',
			file: 'planreviewlocations-groups-source-into-40-line-spans-one-que.json'
		},
		[
			{ name: 'loadSettings: one span and one question', input: loadInput, output: loaded },
			{ name: 'a needs-review item asks nothing', input: timeoutInput, output: timeout },
			{ name: '85 lines: three spans and two questions', input: moduleInput, output: modules }
		]
	);
	expect(outline(loaded)).toEqual({
		spans: { 'span-1': [1, 7] },
		questions: { 'side-effects': ['span-1', 'file_wide'] }
	});
	expect(loaded.spans['span-1'].excerpt).toBe(excerpt);
	expect(outline(timeout)).toEqual({ spans: { 'span-1': [1, 1] }, questions: {} });
	expect(outline(modules).spans).toEqual({
		'span-1': [1, 40],
		'span-2': [41, 80],
		'span-3': [81, 85]
	});
	expect(Object.keys(modules.questions)).toEqual(['side-effects', 'focused-functions']);
});

test('planReviewLocations returns an empty plan when the spans exceed the budget', () => {
	const assessments = [sideEffects];
	const fits = planReviewLocations(spansOf(4, wideLine), assessments);
	const wideOver = planReviewLocations(spansOf(5, wideLine), assessments);
	const blankUnder = planReviewLocations(spansOf(200, ''), assessments);
	const blankOver = planReviewLocations(spansOf(251, ''), assessments);
	const fitsInput = { code: '4 spans, 40 lines each, 120 characters per line', assessments };
	const overInput = { code: '5 spans, 40 lines each, 120 characters per line', assessments };
	const underInput = { code: '200 spans, 40 blank lines each', assessments };
	const blankInput = { code: '251 spans, 40 blank lines each', assessments };
	recordExampleCases(
		{
			unitId: 'audit.clean-code-locations',
			symbol: 'planReviewLocations',
			state: 'planreviewlocations-returns-an-empty-plan-when-the-spans-exc',
			evidence: 'examples-cases',
			file: 'planreviewlocations-returns-an-empty-plan-when-the-spans-exc.json'
		},
		[
			{ name: 'four 120-character spans fit the budget', input: fitsInput, output: outline(fits) },
			{ name: 'five such spans exceed the budget', input: overInput, output: wideOver },
			{ name: '200 blank-line spans exceed the budget', input: underInput, output: blankUnder },
			{ name: '251 blank-line spans exceed the 250 limit', input: blankInput, output: blankOver }
		]
	);
	expect(outline(fits)).toEqual({
		spans: { 'span-1': [1, 40], 'span-2': [41, 80], 'span-3': [81, 120], 'span-4': [121, 160] },
		questions: { 'side-effects': ['span-1', 'span-2', 'span-3', 'span-4', 'file_wide'] }
	});
	expect(Buffer.byteLength(JSON.stringify(fits.spans))).toBeLessThanOrEqual(
		maxReviewStateBytes - 500
	);
	expect([wideOver, blankUnder, blankOver]).toEqual([emptyPlan, emptyPlan, emptyPlan]);
});

test('applyReviewLocations sets a location only from a confident span answer', () => {
	const plan = planReviewLocations(loadCode, loadAssessments);
	const high = applied(plan, localization('span-1', 0.91), 0.85);
	const fileWide = applied(plan, localization('file_wide', 0.88), 0.85);
	const low = applied(plan, localization('span-1', 0.88), 0.9);
	const none = applied(plan, undefined, 0.85);
	recordExampleCases(
		{
			unitId: 'audit.clean-code-locations',
			symbol: 'applyReviewLocations',
			state: 'applyreviewlocations-sets-a-location-only-from-a-confident-s',
			evidence: 'examples-cases',
			file: 'applyreviewlocations-sets-a-location-only-from-a-confident-s.json'
		},
		[
			{ name: 'span-1 at 0.91 clears the 0.85 minimum', input: high.input, output: high.output },
			{
				name: 'file_wide at 0.88 names no plan span',
				input: fileWide.input,
				output: fileWide.output
			},
			{ name: 'span-1 at 0.88 misses the 0.9 minimum', input: low.input, output: low.output },
			{ name: 'no localization result', input: none.input, output: none.output }
		]
	);
	expect(high.output).toEqual([
		{ principle: 'side-effects', location: { startLine: 1, endLine: 7 } },
		{ principle: 'meaningful-names', location: null },
		{ principle: 'async-boundaries', location: null }
	]);
	expect(high.assessments[0].location).toEqual(plan.spans['span-1']);
	const unlocated = [null, null, null];
	for (const run of [fileWide, low, none]) {
		expect(run.output.map(({ location }) => location)).toEqual(unlocated);
	}
});
