import { expect, test } from 'vitest';
import { measureWorkload } from '../../support/measureWorkload';
import {
	pickTrackerModel,
	retryTrackerModel
} from '../../../src/utils/agents-providers/pickTrackerModel';

const visualModule = { title: 'Review module screenshots', agent: 'Harness' };

test('picks the cheapest eligible model for the requested activity', () => {
	const routes = [
		['Review screenshots', 'claude-haiku-5-5', 'high'],
		['Design a dashboard mockup', 'claude-haiku-5-5', 'high'],
		['Polish the dashboard layout', 'claude-haiku-5-5', 'high'],
		['Open the dashboard in Chrome and review its layout', 'gpt-6.1-terra', 'medium'],
		['Use computer use to inspect the dashboard', 'gpt-6.1-terra', 'medium'],
		['Deploy to preprod', 'claude-opus-5-5', 'high'],
		['Promote staging → preprod', 'claude-opus-5-5', 'high'],
		['Promote preprod to production and review screenshots', 'claude-opus-5-5', 'high'],
		['Production rollback', 'claude-opus-5-5', 'high'],
		['Fix the production deploy script', 'gpt-6.2-sol', 'medium'],
		['Deploy from preprod to staging', 'gpt-6.2-sol', 'medium'],
		['Review production deployment logs', 'gpt-6.2-sol', 'medium'],
		['Production deployment plan', 'gpt-6.2-sol', 'medium'],
		['Fix mockup upload', 'gpt-6.2-sol', 'medium'],
		['Fix the screenshot capture script', 'gpt-6.2-sol', 'medium'],
		['Automate browser tests with Playwright', 'gpt-6.2-sol', 'medium'],
		['Fix a typo in the README', 'gpt-6.2-sol', 'medium'],
		['Fix a race condition', 'gpt-6.2-sol', 'high']
	];
	for (const [title, model, effort] of routes) {
		expect(pickTrackerModel({ title }).rung, title).toMatchObject({ model, effort });
	}
	expect(pickTrackerModel({ title: 'Implement a module', project: 'Harness' }).rung).toMatchObject({
		id: 'sol',
		effort: 'medium'
	});
	expect(
		pickTrackerModel({ title: 'Ship the release', notes: 'Target: pre-production' }).rung.id
	).toBe('opus');
	expect(
		pickTrackerModel({ title: 'Fix the rollout script', notes: 'Do not deploy to production.' })
			.rung.id
	).toBe('sol');
	expect(
		pickTrackerModel({ title: 'Polish the dashboard', notes: 'x'.repeat(1_501) }).rung.id
	).toBe('haiku');
	expect(
		pickTrackerModel({ title: 'Implement CSV export', notes: 'x'.repeat(1_501) }).rung.effort
	).toBe('medium');
});

test('keeps explicit model and effort even when the automatic choice can run cheaper', () =>
	measureWorkload('function.agents-providers-pick-tracker-model', 'named-model-selection', () => {
		expect(
			pickTrackerModel(
				{ ...visualModule, model: 'opus:xhigh' },
				{
					history: { haiku: { ok: 25, fail: 0 } }
				}
			)
		).toMatchObject({
			rung: { id: 'opus', model: 'claude-opus-5-5', effort: 'xhigh', pinned: true },
			reason: 'named on the item (opus:xhigh)'
		});
		expect(
			pickTrackerModel({ title: 'Review the scheduler', project: 'Tracker', model: 'fable' })
		).toMatchObject({ rung: { id: 'fable', model: 'claude-fable-5-2', pinned: true } });
	}));

test('enforces the risk floor for automatic choices and pins', () => {
	const risky = { ...visualModule, notes: 'Backfill the database' };
	expect(pickTrackerModel(risky).rung.id).toBe('sonnet');
	expect(pickTrackerModel({ ...risky, model: 'haiku' })).toMatchObject({
		rung: { id: 'sol', pinned: true },
		reason: 'named haiku, raised to Sol (database change)'
	});
	expect(pickTrackerModel({ ...risky, model: 'gpt-6-luna' })).toMatchObject({
		rung: { id: 'sol', pinned: true },
		reason: 'named gpt-6-luna, raised to Sol (database change)'
	});
	expect(pickTrackerModel({ title: 'Fix a label', model: 'haiku' }).rung.id).toBe('sol');
	expect(pickTrackerModel({ title: 'Design a mockup', model: 'haiku' }).rung.id).toBe('haiku');
	expect(pickTrackerModel({ title: 'Use computer use to verify sign-in' }).rung.id).toBe('sol');
	expect(pickTrackerModel({ title: 'Deploy to preprod', model: 'haiku' }).rung.id).toBe('opus');
});

test('learns within each activity’s eligible models', () => {
	const history = { haiku: { ok: 1, fail: 2 }, sonnet: { ok: 0, fail: 5 } };
	expect(pickTrackerModel(visualModule, { history }).reason).toContain(
		'haiku succeeded 33% on similar tasks'
	);
	expect(pickTrackerModel(visualModule, { history }).rung.id).toBe('sonnet');
	expect(
		pickTrackerModel(visualModule, {
			history: { haiku: { ok: 1, fail: 1 } }
		}).rung.id
	).toBe('haiku');
	expect(
		pickTrackerModel(
			{
				title: 'Open the dashboard in Chrome'
			},
			{ history: { terra: { ok: 0, fail: 3 } } }
		).rung.id
	).toBe('sol');
	expect(
		pickTrackerModel(
			{
				title: 'Deploy to production'
			},
			{ history: { opus: { ok: 0, fail: 3 } } }
		).rung.id
	).toBe('opus');
});

test('retries a pin on its named effort and advances Sol effort to its ceiling', () => {
	expect(
		retryTrackerModel(visualModule, {
			rung: 'opus',
			model: 'claude-opus-5-5',
			effort: 'xhigh',
			pinned: 1
		})
	).toMatchObject({ id: 'opus', effort: 'xhigh', pinned: true });
	expect(
		retryTrackerModel(visualModule, { rung: 'haiku', model: 'claude-haiku-5-5' })
	).toMatchObject({ id: 'sonnet', effort: 'medium' });
	expect(
		retryTrackerModel(visualModule, { rung: 'sonnet', model: 'claude-sonnet-5-5' })
	).toMatchObject({ id: 'sonnet', effort: 'medium' });
	expect(
		retryTrackerModel(
			{ title: 'Open the dashboard in Chrome' },
			{
				rung: 'terra',
				model: 'gpt-6.1-terra'
			}
		)
	).toMatchObject({ id: 'sol', effort: 'medium' });
	expect(
		retryTrackerModel(
			{ title: 'Deploy to preprod' },
			{
				rung: 'opus',
				model: 'claude-opus-5-5',
				effort: 'high'
			}
		)
	).toMatchObject({ id: 'opus', effort: 'high' });
	for (const [previous, effort] of [
		['low', 'medium'],
		['medium', 'high'],
		['high', 'xhigh'],
		['xhigh', 'xhigh']
	]) {
		expect(
			retryTrackerModel(
				{ title: 'Fix an intermittent crash' },
				{
					rung: 'sol',
					model: 'gpt-6.2-sol',
					effort: previous
				}
			)
		).toMatchObject({ id: 'sol', effort });
	}
});
