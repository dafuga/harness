import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import type {
	JevChoice,
	JevEvaluation,
	JevQuestions,
	JevRequest,
	JevUsage
} from '../../src/core/agents-providers/jevTypes';

test('Jev evaluation types connect requests and model answers', () => {
	const questions: JevQuestions = {};
	const request = {
		state: 'fixture-state-17',
		questions
	} satisfies JevRequest;
	const choice = {
		type: 'choice',
		choice: 'approve',
		confidence: 0.91,
		probabilities: { approve: 0.91, reject: 0.09 }
	} satisfies JevChoice;
	const usage = { input_tokens: 42, output_tokens: 7 } satisfies JevUsage;
	const evaluation = {
		model: 'fixture-model-v2',
		answers: { 'question-17': choice },
		usage
	} satisfies JevEvaluation;

	expect({ request, evaluation }).toEqual({
		request: { state: 'fixture-state-17', questions: {} },
		evaluation: {
			model: 'fixture-model-v2',
			answers: {
				'question-17': {
					type: 'choice',
					choice: 'approve',
					confidence: 0.91,
					probabilities: { approve: 0.91, reject: 0.09 }
				}
			},
			usage: { input_tokens: 42, output_tokens: 7 }
		}
	});
	recordExampleCases(
		{
			unitId: 'function.jev-types',
			symbol: 'JevEvaluation',
			state: 'jev-evaluation-types-connect-requests-and-model-answers',
			evidence: 'examples-cases',
			file: 'jev-evaluation-types-connect-requests-and-model-answers.json'
		},
		[
			{
				name: 'request and evaluation carry a model choice and token usage',
				input: request,
				output: evaluation
			}
		]
	);
});
