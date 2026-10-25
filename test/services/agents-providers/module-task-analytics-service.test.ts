import { afterEach, test, vi } from 'vitest';
import { expect } from '../../verificationExpect';
import { ModuleTaskAnalyticsService } from '../../../src/services/agents-providers/ModuleTaskAnalyticsService';
import { ModuleTaskService } from '../../../src/services/agents-providers/ModuleTaskService';
import { ModuleTaskWorkerService } from '../../../src/services/agents-providers/ModuleTaskWorkerService';
import type { AnalyticsEvent } from '../../../src/core/reports-media/analyticsTypes';
import { moduleTaskFixture } from '../../support/moduleTaskFixture';
import { observedTaskOperation } from '../../support/taskProfiles';
import { readFile } from 'node:fs/promises';

afterEach(() => vi.unstubAllEnvs());

test('committed task history emits stable IDs and excludes raw prompt text', async () => {
	vi.stubEnv('HARNESS_ANALYTICS_DISABLED', '0');
	const f = await moduleTaskFixture();
	try {
		const service = new ModuleTaskService(f.root);
		await service.feature({
			id: 'checkout',
			goal: 'Reliable checkout',
			tldr: 'Build validated orders.'
		});
		await service.add(JSON.parse(await readFile(await f.input(), 'utf8')));
		await new ModuleTaskWorkerService(f.root, {
			run: async (input) => ({
				provider: input.provider,
				model: input.model,
				intelligence: input.intelligence,
				reportedModel: null,
				text: 'Done'
			})
		}).once('owner');
		const seen = new Map<string, AnalyticsEvent>();
		const analytics = new ModuleTaskAnalyticsService(() => ({
			recordImported: (event) => {
				seen.set(event.id, event);
			},
			close: () => {}
		}));
		await observedTaskOperation(
			'service.agents-providers-module-task-analytics',
			'reconcile-committed-submission-analytics',
			async () => {
				expect(await analytics.sync(f.root)).toBe(2);
				expect(await analytics.sync(f.root)).toBe(2);
			}
		);
		const selected = [...seen.values()].filter((e) => e.kind === 'task');
		expect(selected).toHaveLength(2);
		expect(analytics.metrics(selected)).toMatchObject({
			executions: 1,
			submissions: 1,
			bounceRate: null
		});
		expect(JSON.stringify(selected)).not.toContain('Implement the wanted contract');
		vi.stubEnv('HARNESS_ANALYTICS_DISABLED', '1');
		seen.clear();
		expect(await analytics.sync(f.root)).toBe(0);
		expect(seen.size).toBe(0);
	} finally {
		await f.dispose();
	}
});
test('missing Codex cache-write counts produce a priced range rather than a guessed bill', () => {
	const cost = new ModuleTaskAnalyticsService().quote('gpt-6-luna', {
		inputTokens: 100,
		outputTokens: 20,
		cacheReadTokens: 30,
		cacheWriteTokens: null,
		reportedCostUsd: null
	});
	expect(cost).toMatchObject({
		usd: null,
		basis: 'standard-api-estimate',
		rateCard: 'standard-global-2026-10-25'
	});
	expect(cost.minimumUsd).toBeCloseTo(0.0000173, 10);
	expect(cost.maximumUsd).toBeCloseTo(0.0000278, 10);
});
