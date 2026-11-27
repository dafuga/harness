import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { measureWorkload } from '../../support/measureWorkload';
import {
	pickTrackerModel,
	retryTrackerModel
} from '../../../src/utils/agents-providers/pickTrackerModel';

// These cases cover the table that applies once the Codex limit has reset.
beforeAll(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(Date.parse('2026-11-27T10:39:00Z'));
});
afterAll(() => vi.useRealTimers());

const visualModule = { title: 'Review module screenshots', agent: 'Harness' };

test('uses Astra high for every unpinned non-deploy activity', () => {
	const routes = [
		['Check the service status', 'gpt-6.2-astra', 'high'],
		['Inspect infra metrics', 'gpt-6.2-astra', 'high'],
		['Refactor CSV export', 'gpt-6.2-astra', 'high'],
		['Bump dependencies', 'gpt-6.2-astra', 'high'],
		['Record a QA video', 'gpt-6.2-astra', 'high'],
		['Review screenshots', 'gpt-6.2-astra', 'high'],
		['Review the designs', 'gpt-6.2-astra', 'high'],
		['Create a visual design', 'gpt-6.2-astra', 'high'],
		['Build a dashboard mock-up', 'gpt-6.2-astra', 'high'],
		['Design a dashboard mockup', 'gpt-6.2-astra', 'high'],
		['Polish the dashboard layout', 'gpt-6.2-astra', 'high'],
		['Open the dashboard in Chrome and review its layout', 'gpt-6.2-astra', 'high'],
		['Use computer use to inspect the dashboard', 'gpt-6.2-astra', 'high'],
		['Deploy to preprod', 'claude-opus-5-5', 'high'],
		['Promote staging → preprod', 'claude-opus-5-5', 'high'],
		['Promote preprod to production and review screenshots', 'claude-opus-5-5', 'high'],
		['Production rollback', 'claude-opus-5-5', 'high'],
		['Fix the production deploy script', 'gpt-6.2-astra', 'high'],
		['Deploy from preprod to staging', 'gpt-6.2-astra', 'high'],
		['Review production deployment logs', 'gpt-6.2-astra', 'high'],
		['Production deployment plan', 'gpt-6.2-astra', 'high'],
		['Fix mockup upload', 'gpt-6.2-astra', 'high'],
		['Fix the screenshot capture script', 'gpt-6.2-astra', 'high'],
		['Automate browser tests with Playwright', 'gpt-6.2-astra', 'high'],
		['Fix a typo in the README', 'gpt-6.2-astra', 'high'],
		['Fix a race condition', 'gpt-6.2-astra', 'high']
	];
	for (const [title, model, effort] of routes) {
		expect(pickTrackerModel({ title }).rung, title).toMatchObject({ model, effort });
	}
	expect(pickTrackerModel({ title: 'Implement a module', project: 'Harness' }).rung).toMatchObject({
		id: 'astra',
		effort: 'high'
	});
	expect(
		pickTrackerModel({ title: 'Ship the release', notes: 'Target: pre-production' }).rung.id
	).toBe('opus');
	expect(
		pickTrackerModel({ title: 'Fix the rollout script', notes: 'Do not deploy to production.' })
			.rung.id
	).toBe('astra');
	expect(
		pickTrackerModel({ title: 'Polish the dashboard', notes: 'x'.repeat(1_501) }).rung.id
	).toBe('astra');
	expect(
		pickTrackerModel({ title: 'Implement CSV export', notes: 'x'.repeat(1_501) }).rung.effort
	).toBe('high');
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
	expect(pickTrackerModel(risky).rung.id).toBe('astra');
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
	expect(pickTrackerModel({ title: 'Use computer use to verify sign-in' }).rung.id).toBe('astra');
	expect(pickTrackerModel({ title: 'Deploy to preprod', model: 'haiku' }).rung.id).toBe('opus');
});

test('keeps the default when prior automatic rungs failed', () => {
	const history = { terra: { ok: 1, fail: 2 }, sol: { ok: 0, fail: 4 }, astra: { ok: 0, fail: 3 } };
	expect(
		pickTrackerModel({ title: 'Open the dashboard in Chrome' }, { history }).rung
	).toMatchObject({ id: 'astra', model: 'gpt-6.2-astra', effort: 'high' });
	expect(pickTrackerModel({ title: 'Deploy to production' }, { history }).rung.id).toBe('opus');
});

test('retries eligible pins, keeps Claude deploys, and routes older unpinned receipts to Astra high', () => {
	for (const [model, effort] of [
		['claude-opus-5-5', 'xhigh'],
		['gpt-6.1-terra', 'medium'],
		['gpt-6.2-sol', 'low'],
		['gpt-6.2-astra', 'medium']
	]) {
		expect(
			retryTrackerModel(visualModule, { rung: model, model, effort, pinned: 1 })
		).toMatchObject({ model, effort, pinned: true });
	}
	for (const rung of ['sol-xhigh', 'sol', 'terra', 'haiku', 'astra', 'gpt-6.2-astra']) {
		expect(
			retryTrackerModel({ title: 'Open the dashboard in Chrome' }, { rung, model: rung })
		).toMatchObject({ id: 'astra', model: 'gpt-6.2-astra', effort: 'high' });
	}
	expect(
		retryTrackerModel({ title: 'Deploy to preprod' }, { rung: 'opus', model: 'claude-opus-5-5' })
	).toMatchObject({ id: 'opus', effort: 'high' });
});
