import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { JevResponseValidator } from '../../src/validators/agents-providers/JevResponseValidator';
import { InvalidJevResponseError } from '../../src/validators/agents-providers/JevResponseValidator.types';
import { InvalidJevValueError } from '../../src/validators/development-tooling/cleanCodeValue.types';

const questions = {
	tone: {
		type: 'choice' as const,
		instructions: 'Choose the register.',
		criteria: { formal: 'Formal register.', casual: 'Conversational register.' }
	},
	length: {
		type: 'choice' as const,
		instructions: 'Choose the length.',
		criteria: { short: 'Two or three sentences.', long: 'Several paragraphs.' }
	}
};

const responses = [
	{
		model: 'jev-2.1',
		answers: {
			tone: { type: 'choice', choice: 'formal', confidence: 0.72, probabilities: { formal: 0.72, casual: 0.28 } },
			length: { type: 'choice', choice: 'short', confidence: 0.61, probabilities: { short: 0.61, long: 0.39 } }
		},
		usage: { input_tokens: 512, output_tokens: 48 }
	},
	{
		model: 'jev-mini-0.9',
		answers: {
			tone: { type: 'choice', choice: 'casual', confidence: 0.55, probabilities: { formal: 0.45, casual: 0.55 } },
			length: { type: 'choice', choice: 'long', confidence: 0.6, probabilities: { short: 0.4, long: 0.6 } }
		},
		usage: { input_tokens: 830, output_tokens: 12 }
	}
];

test('Validates Jev choices and usage', () => {
	const validator = new JevResponseValidator();
	const cases = responses.map((input) => {
		const result = validator.validate(input, questions);
		const output = {
			model: result.model,
			choices: Object.fromEntries(Object.entries(result.answers).map(([key, answer]) => [key, answer.choice])),
			usage: result.usage
		};
		expect(output).toEqual({
			model: input.model,
			choices: input === responses[0] ? { tone: 'formal', length: 'short' } : { tone: 'casual', length: 'long' },
			usage: input.usage
		});
		return { name: input.model, input, output };
	});
	recordExampleCases(
		{
			unitId: 'validator.jev-response',
			symbol: 'JevResponseValidator.validate',
			state: 'validates-jev-choices-and-usage',
			evidence: 'examples-cases',
			file: 'validates-jev-choices-and-usage.json'
		},
		cases
	);
});

test('Rejects invalid Jev responses and values', () => {
	const validator = new JevResponseValidator();
	const cases = [
		{ name: 'Invalid Jev model', input: { ...responses[0], model: 'bad-model' }, error: InvalidJevResponseError },
		{ name: 'Missing Jev answers', input: { ...responses[0], answers: { tone: responses[0].answers.tone } }, error: InvalidJevResponseError },
		{ name: 'Invalid Jev choice', input: { ...responses[0], answers: { ...responses[0].answers, tone: { ...responses[0].answers.tone, choice: 'other' } } }, error: InvalidJevResponseError },
		{ name: 'Invalid Jev options', input: { ...responses[0], answers: { ...responses[0].answers, tone: { ...responses[0].answers.tone, probabilities: { formal: 1 } } } }, error: InvalidJevResponseError },
		{ name: 'Invalid Jev distribution', input: { ...responses[0], answers: { ...responses[0].answers, tone: { ...responses[0].answers.tone, probabilities: { formal: 0.5, casual: 0.2 } } } }, error: InvalidJevResponseError },
		{ name: 'Inconsistent Jev choice', input: { ...responses[0], answers: { ...responses[0].answers, tone: { ...responses[0].answers.tone, probabilities: { formal: 0.2, casual: 0.8 } } } }, error: InvalidJevResponseError },
		{ name: 'Invalid Jev response', input: { ...responses[0], answers: null }, error: InvalidJevValueError },
		{ name: 'Invalid Jev probability', input: { ...responses[0], answers: { ...responses[0].answers, tone: { ...responses[0].answers.tone, confidence: 2 } } }, error: InvalidJevValueError },
		{ name: 'Invalid Jev usage', input: { ...responses[0], usage: { input_tokens: -1, output_tokens: 48 } }, error: InvalidJevValueError }
	];
	const recorded = cases.map(({ name, input, error }) => {
		expect(() => validator.validate(input, questions)).toThrow(error);
		return { name, input, error: error.name };
	});
	recordExampleCases(
		{
			unitId: 'validator.jev-response',
			symbol: 'JevResponseValidator.validate',
			state: 'rejects-invalid-jev-responses-and-values',
			evidence: 'examples-cases',
			file: 'rejects-invalid-jev-responses-and-values.json'
		},
		recorded
	);
});
