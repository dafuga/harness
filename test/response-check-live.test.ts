import { expect, test } from 'vitest';
import { assessResponse } from '../src/workflows/responseCheckEvaluate';
import { responseCheckExamples } from './support/responseCheckExamples';

const enabled = process.env.HARNESS_JEV_RESPONSE_LIVE_TEST === 'true';
test.skipIf(!enabled).each(responseCheckExamples)(
	'live response calibration: $name',
	async (example) => {
		if (!process.env.HARNESS_JEV_API_KEY?.trim())
			throw new Error('A dedicated Harness key is required for live calibration.');
		const started = Date.now();
		const result = await assessResponse(
			{
				request: example.request,
				response: example.response,
				context: example.context ?? '',
				criteria: example.criteria ?? []
			},
			{ model: 'jev-1.13.0', minConfidence: 0.85, apiKeyEnv: 'HARNESS_JEV_API_KEY' }
		);
		const judgment = result.checks.find((item) => item.id === example.check);
		console.info(
			JSON.stringify({
				example: example.name,
				expected: example.expected,
				actual: judgment?.status,
				confidence: judgment?.confidence,
				model: result.model,
				usage: result.usage,
				latencyMs: Date.now() - started
			})
		);
		expect(judgment?.status).toBe(example.expected);
	},
	45000
);
