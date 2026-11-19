import { afterEach, test, vi } from 'vitest';
import { expect } from '../../verificationExpect';
import { ModuleTaskAnalyticsService } from '../../../src/services/agents-providers/ModuleTaskAnalyticsService';
import { ModuleTaskService } from '../../../src/services/agents-providers/ModuleTaskService';
import { ModuleTaskWorkerService } from '../../../src/services/agents-providers/ModuleTaskWorkerService';
import type { AnalyticsEvent } from '../../../src/core/reports-media/analyticsTypes';
import { moduleTaskFixture } from '../../support/moduleTaskFixture';
import { observedTaskOperation } from '../../support/taskProfiles';
import { readFile } from 'node:fs/promises';
import { createRunRecord } from '../../../src/services/agents-providers/module-task-analytics-service/modelRunRecord';
import { taskRunRecords } from '../../../src/services/agents-providers/module-task-analytics-service/taskRunRecords';
import { taskRunReport } from '../../../src/services/agents-providers/module-task-analytics-service/taskRunReport';

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
		expectPendingRunRecords(selected);
		vi.stubEnv('HARNESS_ANALYTICS_DISABLED', '1');
		seen.clear();
		expect(await analytics.sync(f.root)).toBe(0);
		expect(seen.size).toBe(0);
	} finally {
		await f.dispose();
	}
});

function expectPendingRunRecords(selected: AnalyticsEvent[]) {
	expect(taskRunRecords(selected, selected)).toMatchObject([
		{
			taskType: 'module',
			outcome: 'pending_review',
			attempt: 1,
			firstTry: false,
			wallTimeMs: expect.any(Number)
		}
	]);
	const legacy = selected.map((event) => ({
		...event,
		moduleTask: { ...event.moduleTask!, run: undefined }
	}));
	expect(taskRunRecords(legacy, legacy)).toMatchObject([
		{ attempt: null, retries: null, estimatedDifficulty: null, wallTimeMs: null }
	]);
}

test('model choice ranks complete first-attempt samples inside each estimated difficulty', () => {
	const records = [
		...pricedModelRuns('claude-haiku-5-5', 'small', 5, 0.002),
		...pricedModelRuns('claude-opus-5-5', 'small', 5, 0.015),
		...pricedModelRuns('claude-opus-5-5', 'large', 5, 0.008),
		...pricedModelRuns('gpt-6.2-sol', 'small', 4, 0.001),
		...pricedModelRuns('unknown-model', 'small', 5, null)
	];
	const report = taskRunReport(records);
	expect(report.recommendations).toMatchObject([
		{
			taskType: 'phase-4',
			model: 'claude-haiku-5-5',
			estimatedDifficulty: 'small',
			firstTryRate: 0.8
		},
		{
			taskType: 'phase-4',
			model: 'claude-opus-5-5',
			estimatedDifficulty: 'large',
			firstTryRate: 0.8
		}
	]);
	expect(report.byModelTaskDifficulty).toContainEqual(
		expect.objectContaining({
			model: 'claude-haiku-5-5',
			estimatedDifficulty: 'small',
			measuredDifficulty: 'medium',
			outcomes: { done: 4, rejected: 1 },
			rejectionsByCause: { verification: 1 }
		})
	);
});

function pricedModelRuns(
	model: string,
	estimatedDifficulty: 'small' | 'large',
	samples: number,
	cost: number | null
) {
	return Array.from({ length: samples }, (_, index) => {
		const id = `${model}-${estimatedDifficulty}-${index}`;
		return createRunRecord({
			source: 'harness',
			id,
			taskId: id,
			chainId: id,
			taskType: 'phase-4',
			project: '/fixture',
			provider: model.startsWith('claude') ? 'claude' : 'codex',
			model,
			effort: 'medium',
			finishedAt: '2026-11-19T12:00:00Z',
			outcome: index === 0 ? 'rejected' : 'done',
			attempt: 1,
			estimatedDifficulty,
			filesTouched: 4,
			rejectionCause: index === 0 ? 'verification' : null,
			usage: {
				inputTokens: null,
				outputTokens: null,
				cacheReadTokens: null,
				cacheWriteTokens: null,
				reportedCostUsd: cost
			}
		});
	});
}
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
		rateCard: 'standard-global-2026-11-19'
	});
	expect(cost.minimumUsd).toBeCloseTo(0.0000173, 10);
	expect(cost.maximumUsd).toBeCloseTo(0.0000278, 10);
});
