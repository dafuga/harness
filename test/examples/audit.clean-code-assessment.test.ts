import type { Choice, Answer, ReviewStatus, Cases } from './audit.clean-code-assessment.test.types';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	assessCleanCode,
	fileReviewStatus,
	reportReviewStatus
} from '../../src/audit/development-tooling/cleanCodeAssessment';
import type {
	FileReview,
	PrincipleAssessment
} from '../../src/audit/development-tooling/cleanCodeTypes';
import type { JevEvaluation } from '../../src/core/agents-providers/jevTypes';

const sampleChoices: Array<[string, Choice, number]> = [
	['meaningful-names', 'meets', 0.93],
	['single-responsibility', 'meets', 0.88],
	['focused-functions', 'violates', 0.91],
	['abstraction-level', 'meets', 0.74],
	['duplication', 'meets', 0.9],
	['side-effects', 'meets', 0.95],
	['error-handling', 'violates', 0.62],
	['comments', 'insufficient_context', 0.85],
	['boundaries', 'meets', 0.89],
	['testability', 'insufficient_context', 0.81],
	['async-boundaries', 'not_applicable', 0.96]
];

function answer(choice: Choice, confidence: number): Answer {
	const probabilities = {
		meets: 0.02,
		violates: 0.02,
		not_applicable: 0.02,
		insufficient_context: 0.02,
		[choice]: confidence
	};
	return { type: 'choice', choice, confidence, probabilities };
}

function sampleEvaluation(): JevEvaluation {
	const answers = Object.fromEntries(
		sampleChoices.map(([id, choice, confidence]): [string, Answer] => [
			id,
			answer(choice, confidence)
		])
	);
	return {
		model: 'jev-1.13.0',
		answers,
		usage: { input_tokens: 18432, output_tokens: 612 }
	};
}

function statusesOf(assessments: PrincipleAssessment[]): Record<string, string> {
	return Object.fromEntries(
		assessments.map((item): [string, string] => [item.principle, item.status])
	);
}

function fileReview(status: ReviewStatus, path: string): FileReview {
	return {
		path,
		contentHash: `content-${path}`,
		contextHash: `context-${path}`,
		status,
		assessments: [],
		contextPaths: [],
		omittedContext: [],
		usage: { input_tokens: 0, output_tokens: 0 },
		cached: false
	};
}

function missingAnswerError(): unknown {
	const evaluation = sampleEvaluation();
	const answers = { ...evaluation.answers };
	delete answers.comments;
	let error: unknown;
	try {
		assessCleanCode({ ...evaluation, answers }, 0.85);
	} catch (caught) {
		error = caught;
	}
	return error;
}

function recordFor(state: string, symbol: string, cases: Cases): void {
	recordExampleCases(
		{
			unitId: 'audit.clean-code-assessment',
			symbol,
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

test('Maps answers to statuses at the confidence threshold', () => {
	const evaluation = sampleEvaluation();
	const atDefault = assessCleanCode(evaluation, 0.85);
	const strict = assessCleanCode(evaluation, 0.9);
	expect(atDefault).toHaveLength(11);
	expect(statusesOf(atDefault)['error-handling']).toBe('needs-review');
	expect(statusesOf(atDefault)['async-boundaries']).toBe('not-applicable');
	expect(statusesOf(strict)['single-responsibility']).toBe('needs-review');
	expect(statusesOf(strict)['meaningful-names']).toBe('meets');

	recordFor('maps-answers-to-statuses-at-the-confidence-threshold', 'assessCleanCode', [
		{ name: 'minConfidence 0.85', input: { minConfidence: 0.85 }, output: statusesOf(atDefault) },
		{ name: 'minConfidence 0.9', input: { minConfidence: 0.9 }, output: statusesOf(strict) }
	]);
});

test('Rolls file assessments up to one file status', () => {
	const assessments = assessCleanCode(sampleEvaluation(), 0.85);
	const withoutViolations = assessments.filter((item) => item.status !== 'violates');
	const clean = withoutViolations.filter((item) => item.status !== 'needs-review');
	expect(fileReviewStatus(assessments)).toBe('violations');
	expect(fileReviewStatus(withoutViolations)).toBe('needs-review');
	expect(fileReviewStatus(clean)).toBe('clean');
	expect(fileReviewStatus([])).toBe('clean');

	recordFor('rolls-file-assessments-up-to-one-file-status', 'fileReviewStatus', [
		{ name: 'all principles', input: statusesOf(assessments), output: 'violations' },
		{ name: 'without violations', input: statusesOf(withoutViolations), output: 'needs-review' },
		{ name: 'only meets and not-applicable', input: statusesOf(clean), output: 'clean' },
		{ name: 'no assessments', input: [], output: 'clean' }
	]);
});

test('Reports the worst file status across a report', () => {
	const reports: ReviewStatus[][] = [
		[],
		['clean'],
		['clean', 'needs-review'],
		['violations', 'needs-review'],
		['violations', 'incomplete'],
		['clean', 'incomplete']
	];
	expect(reportReviewStatus([])).toBe('not-applicable');
	expect(reportReviewStatus([fileReview('violations', 'a.ts'), fileReview('incomplete', 'b.ts')])).toBe(
		'incomplete'
	);

	const cases: Cases = reports.map((statuses) => ({
		name: statuses.length === 0 ? 'no files' : statuses.join(' + '),
		input: statuses,
		output: reportReviewStatus(statuses.map((status, index) => fileReview(status, `file-${index}.ts`)))
	}));
	recordFor('reports-the-worst-file-status-across-a-report', 'reportReviewStatus', cases);
});

test('Throws a TypeError when a principle has no answer', () => {
	const error = missingAnswerError();
	expect(error).toBeInstanceOf(TypeError);
	expect((error as Error).name).toBe('TypeError');

	recordFor('throws-a-typeerror-when-a-principle-has-no-answer', 'assessCleanCode', [
		{ name: 'comments answer missing', input: { missing: 'comments' }, error: { name: 'TypeError' } }
	]);
});
