import { test } from 'vitest';
import { expect } from './verificationExpect';
import { analyticsSnapshot } from '../src/workflows/analyticsMetrics';
import type { AnalyticsEvent } from '../src/core/analyticsTypes';
import { measureWorkload } from './support/measureWorkload';
function attempt(id: string, status: string, extra: Partial<AnalyticsEvent> = {}): AnalyticsEvent {
	return {
		id,
		timestamp: `2026-10-06T12:00:0${id}Z`,
		project: '/project',
		kind: 'jev',
		action: 'assessed',
		checkType: 'response',
		task: 'answer',
		status,
		fingerprint: id,
		...extra
	};
}
const taskEvent = (id: string, action: string, run: string) =>
	({
		id,
		timestamp: '2026-10-24T12:00:00Z',
		project: '/project',
		kind: 'task',
		action,
		task: 'orders',
		agentModel: 'gpt-6-luna',
		moduleTask: {
			attempt: run,
			feature: 'checkout',
			module: 'service.orders',
			provider: 'codex',
			model: 'gpt-6-luna',
			intelligence: 'max',
			reportedModel: 'gpt-6-luna',
			usage: { inputTokens: 100, outputTokens: 20, cacheReadTokens: 30, cacheWriteTokens: 0 },
			apiCost: {
				usd: 0.002,
				minimumUsd: 0.002,
				maximumUsd: 0.002,
				basis: 'standard-api-estimate'
			}
		}
	}) as unknown as AnalyticsEvent;
test('module task analytics retain model usage and count rejected completions once', async () => {
	const events = [
		taskEvent('1', 'executed', 'first'),
		taskEvent('2', 'submitted', 'first'),
		taskEvent('3', 'incomplete', 'first'),
		taskEvent('4', 'executed', 'second'),
		taskEvent('5', 'submitted', 'second'),
		taskEvent('6', 'accepted', 'second')
	];
	const snapshot = await measureWorkload(
		'workflow.analytics-metrics',
		'module-task-model-usage-and-bounces',
		() => analyticsSnapshot([...events, events[2]])
	);
	expect(snapshot, 'module task usage and bounce analytics must be available').toMatchObject({
		tasks: {
			submissions: 2,
			accepted: 1,
			bounces: 1,
			reviewed: 2,
			bounceRate: 0.5,
			byModel: [
				{
					model: 'gpt-6-luna',
					intelligence: 'max',
					modelSource: 'reported',
					executions: 2,
					inputTokens: 200,
					outputTokens: 40,
					cacheReadTokens: 60,
					apiCostUsd: 0.004,
					bounces: 1,
					reviewed: 2,
					bounceRate: 0.5
				}
			]
		}
	});
	expect(analyticsSnapshot(events, { project: '/different' })).toMatchObject({
		tasks: { executions: 0, reviewed: 0, bounceRate: null, byModel: [] }
	});
});
test('unreported module usage and unreviewed completions remain unknown', () => {
	const events = [
		{
			id: 'unknown',
			timestamp: '2026-10-24T12:00:00Z',
			project: '/project',
			kind: 'task',
			action: 'executed',
			task: 'orders',
			moduleTask: {
				attempt: 'one',
				feature: 'checkout',
				module: 'service.orders',
				provider: 'codex',
				model: 'gpt-6-luna',
				intelligence: 'max',
				reportedModel: null
			}
		} as unknown as AnalyticsEvent
	];
	expect(analyticsSnapshot(events)).toMatchObject({
		tasks: {
			byModel: [
				{
					model: 'gpt-6-luna',
					modelSource: 'requested',
					inputTokens: null,
					outputTokens: null,
					apiCostUsd: null,
					unpricedExecutions: 1,
					bounceRate: null
				}
			]
		}
	});
});
test('first assessed task attempt is attributed to its first author across revisions', () => {
	const data = analyticsSnapshot([
		attempt('1', 'incomplete'),
		attempt('2', 'violations', { agentModel: 'author-a' }),
		attempt('3', 'satisfied', { agentModel: 'author-b' })
	]);
	expect(data.jev.response.firstTry).toEqual({ numerator: 0, denominator: 1, rate: 0 });
	expect(data.jev.response.tasks[0]).toMatchObject({ attemptsToPass: 2, agentModel: 'author-a' });
	expect(data.models.firstTryByAuthor['author-a'].response.firstTry.denominator).toBe(1);
	expect(data.models.firstTryByAuthor['author-b'].response.firstTry.denominator).toBe(0);
});
test('cached checks, dry runs, unlinked and duplicate content are excluded', () => {
	const data = analyticsSnapshot([
		attempt('1', 'dry-run'),
		attempt('2', 'satisfied', { cached: true }),
		attempt('3', 'needs-review'),
		attempt('4', 'satisfied', { task: undefined }),
		attempt('5', 'needs-review', { fingerprint: '3' }),
		attempt('6', 'satisfied')
	]);
	expect(data.jev.response.excluded).toBe(4);
	expect(data.jev.response.tasks[0].attemptsToPass).toBe(2);
	expect(data.jev.response.firstTry.numerator).toBe(0);
});
test('project and check kind separate identities and no tasks gives null rate', () => {
	const data = analyticsSnapshot([
		attempt('1', 'satisfied'),
		attempt('2', 'clean', { checkType: 'clean-code' }),
		attempt('3', 'violations', { project: '/other' })
	]);
	expect(data.jev.response.firstTry).toMatchObject({ numerator: 1, denominator: 2 });
	expect(data.jev.cleanCode.firstTry).toMatchObject({ numerator: 1, denominator: 1 });
	expect(analyticsSnapshot([]).jev.response.firstTry.rate).toBeNull();
});

test('model filters retain the task first author instead of promoting a later revision', () => {
	const events = [
		attempt('1', 'violations', { agentModel: 'a' }),
		attempt('2', 'satisfied', { agentModel: 'b' })
	];
	expect(analyticsSnapshot(events, { model: 'b' }).jev.response.firstTry.denominator).toBe(0);
	expect(analyticsSnapshot(events, { model: 'a' }).jev.response.tasks[0].attemptsToPass).toBe(2);
});

test('model and template names matching object properties still count correctly', () => {
	const data = analyticsSnapshot([
		attempt('1', 'satisfied', { agentModel: '__proto__', evaluatorModel: 'constructor' })
	]);
	expect(data.models.authors['__proto__']).toBe(1);
	expect(data.models.evaluators['constructor']).toBe(1);
});
