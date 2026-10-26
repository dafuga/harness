import { afterEach, test, vi } from 'vitest';
import { expect } from '../../verificationExpect';
import { ModuleTaskAnalyticsService } from '../../../src/services/agents-providers/ModuleTaskAnalyticsService';
import { ModuleTaskService } from '../../../src/services/agents-providers/ModuleTaskService';
import { ModuleTaskWorkerService } from '../../../src/services/agents-providers/ModuleTaskWorkerService';
import type { AnalyticsEvent } from '../../../src/core/reports-media/analyticsTypes';
import { moduleTaskFixture } from '../../support/moduleTaskFixture';
import { observedTaskOperation } from '../../support/taskProfiles';
import { mockContexts } from './module-task-worker.test.fixtures';
import { taskEvents } from '../../../src/services/agents-providers/module-task-analytics-service/taskEvents';
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
		await new ModuleTaskWorkerService(
			f.root,
			{
				run: async (input) => ({
					provider: input.provider,
					model: input.model,
					intelligence: input.intelligence,
					reportedModel: null,
					text: 'Done'
				})
			},
			mockContexts().contexts
		).once('owner');
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

test('prelaunch failures never become model executions or invented costs', async () => {
	vi.stubEnv('HARNESS_ANALYTICS_DISABLED', '0');
	for (const mode of ['context', 'launch'] as const) {
		const f = await moduleTaskFixture();
		try {
			const service = new ModuleTaskService(f.root);
			await service.feature({
				id: 'checkout',
				goal: 'Reliable checkout',
				tldr: 'Build validated orders.'
			});
			await service.add(JSON.parse(await readFile(await f.input(), 'utf8')));
			const worker = new ModuleTaskWorkerService(
				f.root,
				{
					run: async () => {
						throw Object.assign(new Error('Fixture launch blocked'), {
							diagnostic: { phase: 'prelaunch' }
						});
					}
				},
				mockContexts(mode === 'context').contexts
			);
			expect((await worker.once('owner')).status).toBe('failed');
			const events: AnalyticsEvent[] = [];
			const analytics = new ModuleTaskAnalyticsService(() => ({
				recordImported: (event) => events.push(event),
				close: () => {}
			}));
			await analytics.sync(f.root);
			expect(events.map((event) => event.action)).toEqual(['prelaunch-failed']);
			expect(analytics.metrics(events)).toMatchObject({
				executions: 0,
				prelaunchFailures: 1,
				unverifiedExecutions: 0,
				apiCostUsd: null,
				bounceRate: null
			});
			const legacy = (await service.show('orders-validation')).task;
			delete legacy.result!.attempt;
			legacy.result!.executions = [];
			expect(taskEvents([legacy], 'fixture').map((event) => event.action)).toEqual([
				'execution-unknown'
			]);
		} finally {
			await f.dispose();
		}
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

test('quota fallback distinguishes a blocked second launch and corrects its prior event', async () => {
	const f = await moduleTaskFixture();
	try {
		const service = new ModuleTaskService(f.root);
		await service.feature({
			id: 'checkout',
			goal: 'Reliable checkout',
			tldr: 'Build validated orders.'
		});
		await service.add(JSON.parse(await readFile(await f.input(), 'utf8')));
		let calls = 0;
		const worker = new ModuleTaskWorkerService(
			f.root,
			{
				run: async () => {
					if (!calls++) throw Object.assign(new Error('quota'), { quotaRejected: true });
					throw Object.assign(new Error('Provider launch was blocked before execution.'), {
						diagnostic: { phase: 'prelaunch' }
					});
				}
			},
			mockContexts().contexts
		);
		expect((await worker.once('owner')).status).toBe('failed');
		const task = (await service.show('orders-validation')).task;
		expect(task.result?.executions.map((item) => item.status)).toEqual(['failed', 'failed']);
		expect(task.result?.executions[1].apiCost.note).toBe(
			'Provider did not start; no usage or cost was incurred.'
		);
		const events = taskEvents([task], 'fixture');
		expect(events.map((event) => event.action)).toEqual(['executed', 'prelaunch-failed']);
		expect(new ModuleTaskAnalyticsService().metrics(events)).toMatchObject({
			executions: 1,
			prelaunchFailures: 1
		});
		const historical = structuredClone(task);
		historical.result!.executions[1].apiCost.note = 'Legacy unavailable cost';
		const corrected = taskEvents([historical], 'fixture');
		expect(corrected[1]).toMatchObject({ id: events[1].id, action: 'prelaunch-failed' });
		historical.result!.error = 'Resource queue wait timed out';
		expect(taskEvents([historical], 'fixture')[1]).toMatchObject({
			id: events[1].id,
			action: 'prelaunch-failed'
		});
	} finally {
		await f.dispose();
	}
});
