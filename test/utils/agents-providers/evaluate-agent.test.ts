import { expect, test, vi } from 'vitest';
import { z } from 'zod';
import { evaluateAgent } from '../../../src/utils/agents-providers/evaluateAgent';
import { withTempDir } from '../../support/temporary';
import { fixtureBugClass, fixtureEvaluator } from '../../support/sibling-bug-sweep/bugFixture';
import { bugClassSchema } from '../../../src/core/development-tooling/bug-class/bugClassSchemas';
import { measureWorkload } from '../../support/measureWorkload';

test('evaluateAgent validates the final response from a bounded read-only child', async () => {
	await withTempDir('harness-evaluator-fixture-', async (root) => {
		const env = await fixtureEvaluator(root);
		for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
		try {
			const input = {
				model: 'fixture-model',
				prompt: '{"report":"parse"}',
				schema: bugClassSchema
			};
			const verdict = await measureWorkload(
				'function.agents-providers-evaluate-agent',
				'read-only-evaluator',
				() => evaluateAgent(input)
			);
			expect(verdict).toEqual(fixtureBugClass);
			await expect(
				evaluateAgent({ ...input, schema: z.strictObject({ unrelated: z.boolean() }) })
			).rejects.toThrow();
		} finally {
			vi.unstubAllEnvs();
		}
	});
}, 30_000);
