import { expect, test } from 'vitest';
import { CleanCodeResponseValidator } from '../../src/validators/CleanCodeResponseValidator';
import { cleanCodeQuestions } from '../../src/audit/cleanCodeRubric';
import { fixtureEvaluation } from '../support/cleanCodeFixture';

const questions = cleanCodeQuestions();
const request = { state: '', questions };
const validator = new CleanCodeResponseValidator();

test('accepts and normalizes the exact typed answer contract', () => {
	const response = fixtureEvaluation(request);
	expect(validator.validate({ ...response, extra: 'discarded' }, questions)).toEqual(response);
});

test.each([
	{ type: 'score' },
	{ choice: 'invented' },
	{ confidence: -1 },
	{ confidence: Number.NaN },
	{ probabilities: { meets: 1 } },
	{ probabilities: { meets: 0.9, violates: 0.9, not_applicable: 0, insufficient_context: 0 } },
	{ choice: 'violates' }
])('rejects invalid choices, confidence, and distributions: %j', (changes) => {
	const response = fixtureEvaluation(request);
	const key = Object.keys(questions)[0];
	const invalid = {
		...response,
		answers: { ...response.answers, [key]: { ...response.answers[key], ...changes } }
	};
	expect(() => validator.validate(invalid, questions)).toThrow();
});

test.each([null, {}, { extra: {} }])('rejects missing and unexpected answers: %j', (answers) => {
	expect(() => validator.validate({ ...fixtureEvaluation(request), answers }, questions)).toThrow();
});

test.each([-1, 1.5, Number.POSITIVE_INFINITY])(
	'rejects invalid token usage: %s',
	(input_tokens) => {
		expect(() =>
			validator.validate(
				{ ...fixtureEvaluation(request), usage: { input_tokens, output_tokens: 0 } },
				questions
			)
		).toThrow();
	}
);
