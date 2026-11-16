import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { JevResponseValidator } from '../../src/validators/agents-providers/JevResponseValidator';

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
