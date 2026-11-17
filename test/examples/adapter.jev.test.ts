import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { JevAdapter } from '../../src/adapters/agents-providers/JevAdapter';

const request = {
	state: 'Compare two concise summaries',
	questions: {
		preferred: {
			type: 'choice' as const,
			instructions: 'Which summary is clearer?',
			criteria: { concise: 'Uses fewer words', detailed: 'Explains more context' }
		}
	}
};
const response = {
	model: 'jev-latest',
	answers: {
		preferred: {
			type: 'choice',
			choice: 'concise',
			confidence: 0.8,
			probabilities: { concise: 0.8, detailed: 0.2 }
		}
	},
	usage: { input_tokens: 31, output_tokens: 7 }
};

test('evaluate validates a Jev choice response', async () => {
	const adapter = new JevAdapter({
		apiKey: 'typesafe-example-key',
		model: 'jev-latest',
		fetch: async () => new Response(JSON.stringify(response), { status: 200 })
	});
	const output = await adapter.evaluate(request);
	expect(output).toEqual(response);
	recordExampleCases(
		{
			unitId: 'adapter.jev',
			symbol: 'JevAdapter.evaluate',
			state: 'evaluate-validates-a-jev-choice-response',
			evidence: 'examples-cases',
			file: 'evaluate-validates-a-jev-choice-response.json'
		},
		[{ name: 'choice question returns a validated answer and token usage', input: request, output }]
	);
});
