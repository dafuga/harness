import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { assessResponse, responseStatus } from '../../src/cli/program/responseCheckEvaluate';
import type { Evaluate } from '../../src/cli/program/responseCheckEvaluate.types';

const input = {
	request: 'What is 6 multiplied by 7?',
	response: '6 × 7 = 42.',
	context: 'No additional context.',
	criteria: [{ id: 'include-result', description: 'State the numeric result of the multiplication.' }]
};
const settings = { model: 'jev-response-check', minConfidence: 0.85, apiKeyEnv: 'JEV_API_KEY' };
const answer = {
	type: 'choice' as const,
	choice: 'meets',
	confidence: 0.97,
	probabilities: { meets: 0.97, violates: 0.01, insufficient_context: 0.02 }
};
const assessment = (status: 'meets' | 'violates' | 'needs-review') => ({
	...answer,
	id: 'fulfillment',
	title: 'Task fulfillment',
	guidance: 'The response fulfills the requested task.',
	status
});

test('Assesses a response with the supplied evaluator', async () => {
	const evaluate: Evaluate = async (request) => ({
		model: 'jev-response-check',
		answers: Object.fromEntries(Object.keys(request.questions).map((id) => [id, answer])),
		usage: { input_tokens: 128, output_tokens: 24 }
	});
	const result = await assessResponse(input, settings, evaluate);

	expect(result.status).toBe('satisfied');
	expect(result.model).toBe('jev-response-check');
	expect(result.checks).toHaveLength(5);
	expect(result.checks.find((check) => check.id === 'custom:include-result')?.status).toBe('meets');
	recordExampleCases(
		{
			unitId: 'workflow.response-check-evaluate',
			symbol: 'assessResponse',
			state: 'assesses-a-response-with-the-supplied-evaluator',
			evidence: 'examples-cases',
			file: 'assesses-a-response-with-the-supplied-evaluator.json'
		},
		[
			{
				name: 'all standard and custom checks pass with evaluator usage retained',
				input: { input, settings, evaluator: 'supplied' },
				output: {
					status: result.status,
					model: result.model,
					checkIds: result.checks.map((check) => check.id),
					customStatus: result.checks.find((check) => check.id === 'custom:include-result')?.status,
					usage: result.usage
				}
			}
		]
	);
});

test('Aggregates response check statuses by severity', () => {
	const cases = [
		{ name: 'all satisfied', input: [assessment('meets')], output: 'satisfied' },
		{ name: 'review without violation', input: [assessment('needs-review')], output: 'needs-review' },
		{
			name: 'violation takes precedence over review',
			input: [assessment('needs-review'), assessment('violates')],
			output: 'violations'
		},
		{ name: 'empty checks are satisfied', input: [], output: 'satisfied' }
	];
	const actual = cases.map((item) => responseStatus(item.input));

	expect(actual).toEqual(cases.map((item) => item.output));
	recordExampleCases(
		{
			unitId: 'workflow.response-check-evaluate',
			symbol: 'responseStatus',
			state: 'aggregates-response-check-statuses-by-severity',
			evidence: 'examples-cases',
			file: 'aggregates-response-check-statuses-by-severity.json'
		},
		cases.map((item, index) => ({
			name: item.name,
			input: item.input,
			output: actual[index]
		}))
	);
});

test('Throws Error when credential environment variable is missing', async () => {
	const error = await assessResponse(input, {
		...settings,
		apiKeyEnv: 'HARNESS_RESPONSE_CHECK_MISSING_CREDENTIAL'
	}).catch((caught: unknown) => caught);

	expect(error).toBeInstanceOf(Error);
	expect(error).toHaveProperty(
		'message',
		'Missing project-owned JEV credential in the selected environment variable.'
	);
	recordExampleCases(
		{
			unitId: 'workflow.response-check-evaluate',
			symbol: 'assessResponse',
			state: 'throws-error-when-credential-environment-variable-is-missing',
			evidence: 'examples-cases',
			file: 'throws-error-when-credential-environment-variable-is-missing.json'
		},
		[
			{
				name: 'nonblank response requires selected environment credential',
				input: { input, apiKeyEnv: 'HARNESS_RESPONSE_CHECK_MISSING_CREDENTIAL' },
				error: {
					name: (error as Error).name,
					message: (error as Error).message
				}
			}
		]
	);
});
