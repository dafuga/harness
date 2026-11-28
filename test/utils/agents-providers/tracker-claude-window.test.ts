import { expect, test } from 'vitest';
import { pickTrackerModel } from '../../../src/utils/agents-providers/pickTrackerModel';
import { retryTrackerModel } from '../../../src/utils/agents-providers/retryTrackerModel';

// Codex resets 27 Nov 2026 10:39 Europe/Lisbon, which is UTC+0 in November.
const reset = Date.parse('2026-11-27T10:39:00Z');
const before = reset - 1;

test('routes work by task type to the cheapest Claude rung until the Codex reset', () => {
	const routes = [
		['Add CSV export to the report', 'claude-sonnet-5-5', 'medium'],
		['Fix the login redirect bug', 'claude-sonnet-5-5', 'medium'],
		['Triage the open issues', 'claude-sonnet-5-5', 'medium'],
		['Migrate the report cache', 'claude-sonnet-5-5', 'medium'],
		['Refactor the scheduler', 'claude-sonnet-5-5', 'medium'],
		['Fix a race condition in the queue', 'claude-sonnet-5-5', 'high'],
		['Open the dashboard in Chrome and review its layout', 'claude-sonnet-5-5', 'high'],
		['Record a QA video of the checkout flow', 'claude-sonnet-5-5', 'high'],
		['Design a dashboard mockup', 'claude-fable-5-2', 'high'],
		['Review screenshots', 'claude-sonnet-5-5', 'medium'],
		['Update the README', 'claude-haiku-5-5', 'high'],
		['Add tests for the parser', 'claude-haiku-5-5', 'high'],
		['Watch the pull request for CI failures', 'claude-haiku-5-5', 'high'],
		['Remind Daniel about the renewal', 'claude-haiku-5-5', 'high'],
		['Rename the helper', 'claude-haiku-5-5', 'high'],
		['Update the README for the payments API', 'claude-sonnet-5-5', 'medium'],
		['Deploy to preprod', 'claude-sonnet-5-5', 'high'],
		['Promote preprod to production', 'claude-sonnet-5-5', 'high'],
		['Deploy BuildFlexity to preprod', 'claude-opus-5-5', 'high'],
		['[hard] Fix an intermittent crash', 'claude-opus-5-5', 'high']
	];
	for (const [title, model, effort] of routes) {
		expect(pickTrackerModel({ title }, { now: before }).rung, title).toMatchObject({
			model,
			effort
		});
	}
});

test('never picks Codex automatically before the reset, even for a large task', () => {
	for (const title of ['Implement CSV export', 'Fix the build', 'Use computer use to test']) {
		const { rung } = pickTrackerModel({ title, notes: 'x'.repeat(2_000) }, { now: before });
		expect(rung.cli, title).toBe('claude');
	}
});

test('records the chosen rung and why', () => {
	const { rung, reason } = pickTrackerModel({ title: 'Add CSV export' }, { now: before });
	expect(rung.id).toBe('sonnet');
	expect(reason).toBe(
		'feature/small: sonnet medium; features, fixes, ops and triage: Sonnet medium; Claude only until the Codex reset, 27 Nov 10:39 Lisbon'
	);
});

test('switches to the post-reset table at 10:39 Lisbon on 27 November', () => {
	const item = { title: 'Add CSV export to the report' };
	expect(pickTrackerModel(item, { now: reset - 1 }).rung.id).toBe('sonnet');
	expect(pickTrackerModel(item, { now: reset }).rung).toMatchObject({
		id: 'sol',
		effort: 'medium'
	});
	expect(pickTrackerModel({ title: 'Update the README' }, { now: reset }).rung.id).toBe('sol');
	expect(pickTrackerModel({ title: 'Deploy to preprod' }, { now: reset }).rung).toMatchObject({
		id: 'sonnet',
		effort: 'high'
	});
	expect(pickTrackerModel({ title: 'Open the dashboard in Chrome' }, { now: reset }).rung.id).toBe(
		'terra'
	);
});

test('lets the config move the reset time', () => {
	const cfg = { autolaunch: { claudeOnlyUntil: '2026-11-28T00:00:00Z' } };
	const item = { title: 'Add CSV export' };
	expect(pickTrackerModel(item, { cfg, now: reset + 1 }).rung.id).toBe('sonnet');
	expect(pickTrackerModel(item, { cfg, now: Date.parse('2026-11-28T00:00:00Z') }).rung.id).toBe(
		'sol'
	);
});

test('keeps explicit pins, and still floors Haiku for risky work', () => {
	const now = before;
	expect(pickTrackerModel({ title: 'Add CSV export', model: 'sol' }, { now }).rung).toMatchObject({
		id: 'sol',
		effort: 'medium',
		pinned: true
	});
	expect(
		pickTrackerModel({ title: 'Add CSV export', model: 'gpt-6.2-sol:xhigh' }, { now }).rung
	).toMatchObject({ model: 'gpt-6.2-sol', effort: 'xhigh', pinned: true });
	expect(pickTrackerModel({ title: 'Add CSV export', model: 'opus' }, { now }).rung).toMatchObject({
		id: 'opus',
		pinned: true
	});
	expect(pickTrackerModel({ title: 'Add CSV export', model: 'haiku' }, { now }).rung).toMatchObject(
		{ id: 'haiku', pinned: true }
	);
	expect(pickTrackerModel({ title: 'Fix a billing bug', model: 'haiku' }, { now })).toMatchObject({
		rung: { id: 'sonnet', effort: 'medium', pinned: true },
		reason: 'named haiku, raised to Sonnet (sensitive (payments))'
	});
	expect(
		pickTrackerModel({ title: 'Deploy to preprod', model: 'haiku' }, { now }).rung
	).toMatchObject({ id: 'sonnet', effort: 'high' });
});

test('escalates a failed attempt up its own Claude route', () => {
	const run = (rung: string, model: string, effort: string) => ({ rung, model, effort });
	const haiku = run('haiku', 'claude-haiku-5-5', 'high');
	const sonnet = run('sonnet', 'claude-sonnet-5-5', 'medium');
	const sonnetHigh = run('sonnet', 'claude-sonnet-5-5', 'high');
	const opus = run('opus', 'claude-opus-5-5', 'high');
	const next = (item: { title: string }, previous: ReturnType<typeof run>) => {
		const { id, effort } = retryTrackerModel(item, previous, { now: before });
		return `${id} ${effort}`;
	};
	const docs = { title: 'Update the README' };
	expect(next(docs, haiku)).toBe('sonnet medium');
	expect(next(docs, sonnet)).toBe('sonnet high');
	expect(next(docs, sonnetHigh)).toBe('opus high');
	expect(next(docs, opus)).toBe('opus high');
	expect(next({ title: 'Add CSV export' }, sonnet)).toBe('sonnet high');
	expect(next({ title: 'Add CSV export' }, sonnetHigh)).toBe('opus high');
	expect(next({ title: 'Record a QA video' }, sonnetHigh)).toBe('opus high');
	expect(next({ title: 'Deploy to preprod' }, opus)).toBe('opus high');
	expect(next(docs, run('sol', 'gpt-6.2-sol', 'medium'))).toBe('haiku high');
	expect(next({ title: 'Add CSV export' }, run('sol', 'gpt-6.2-sol', 'high'))).toBe(
		'sonnet medium'
	);
});

test('retries after the reset use the post-reset table', () => {
	expect(
		retryTrackerModel(
			{ title: 'Add CSV export' },
			{ rung: 'sonnet', model: 'claude-sonnet-5-5', effort: 'medium' },
			{ now: reset }
		)
	).toMatchObject({ id: 'sol', effort: 'medium' });
});
