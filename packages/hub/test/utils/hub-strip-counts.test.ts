import { expect, test } from 'vitest';
import type {
	HomeAgent,
	HomeOpenAsk
} from '../../../reports/src/lib/projects-sessions/hub-home/hubHome.types';
import { stripCounts } from '../../../reports/src/components/projects-sessions/hub-home/hubStripCounts';

const now = Date.parse('2026-11-21T22:30:00Z');

function agent(overrides: Partial<HomeAgent>): HomeAgent {
	return {
		id: 'agent-sample',
		name: 'Sample agent',
		state: 'working',
		sessions: 0,
		tasks: [],
		subAgents: { sessions: 0, tasks: [] },
		itemId: null,
		task: 'Sample task',
		machine: 'sample-box',
		model: null,
		since: '2026-11-21T20:00:00Z',
		question: null,
		messages: [],
		...overrides
	};
}

function ask(since: string): HomeOpenAsk {
	return {
		itemId: 'item-sample',
		agentId: 'agent-sample',
		agentName: 'Sample agent',
		title: 'Sample ask',
		question: 'Sample question?',
		options: [{ label: 'Yes', effect: 'Continue' }],
		since
	};
}

test('no agents and no asks show nothing running and nothing waiting', () => {
	expect(stripCounts([], [], now)).toEqual({
		sessions: { label: 'Sessions running', value: 0, sub: 'Nothing running' },
		needsYou: { label: 'Needs you', value: 0, sub: 'Nothing waiting' }
	});
});

test('Claude and Codex sessions split, counting sub-agent sessions', () => {
	const agents = [
		agent({ model: 'claude-opus-sample', sessions: 2, subAgents: { sessions: 2, tasks: [] } }),
		agent({ id: 'agent-two', model: 'gpt-sample', sessions: 3 })
	];
	expect(stripCounts(agents, [], now).sessions).toEqual({
		label: 'Sessions running',
		value: 7,
		sub: '4 Claude · 3 Codex'
	});
});

test('an Other model and a null model both count as Other', () => {
	const agents = [
		agent({ model: 'llama-sample', sessions: 1 }),
		agent({ id: 'agent-two', model: null, sessions: 2 }),
		agent({ id: 'agent-three', model: 'sonnet-sample', sessions: 1 })
	];
	expect(stripCounts(agents, [], now).sessions).toEqual({
		label: 'Sessions running',
		value: 4,
		sub: '1 Claude · 3 Other'
	});
});

test('agents with zero sessions are left out of the split', () => {
	const agents = [
		agent({ model: 'claude-haiku-sample', sessions: 0 }),
		agent({ id: 'agent-two', model: 'codex-sample', sessions: 2 })
	];
	expect(stripCounts(agents, [], now).sessions).toEqual({
		label: 'Sessions running',
		value: 2,
		sub: '2 Codex'
	});
});

test('the oldest of three asks sets the waiting age', () => {
	const asks = [
		ask('2026-11-21T21:50:00Z'),
		ask('2026-11-21T20:16:00Z'),
		ask('2026-11-21T21:00:00Z')
	];
	expect(stripCounts([], asks, now).needsYou).toEqual({
		label: 'Needs you',
		value: 3,
		sub: 'Oldest waiting 2h 14m'
	});
});

test('a wait under an hour shows whole minutes', () => {
	expect(stripCounts([], [ask('2026-11-21T21:45:00Z')], now).needsYou.sub).toBe(
		'Oldest waiting 45m'
	);
});

test('a wait of whole hours drops the zero minutes', () => {
	expect(stripCounts([], [ask('2026-11-21T19:30:00Z')], now).needsYou.sub).toBe(
		'Oldest waiting 3h'
	);
});

test('a wait of days and hours shows both, and a whole day drops the zero hours', () => {
	expect(stripCounts([], [ask('2026-11-19T17:30:00Z')], now).needsYou.sub).toBe(
		'Oldest waiting 2d 5h'
	);
	expect(stripCounts([], [ask('2026-11-20T22:30:00Z')], now).needsYou.sub).toBe(
		'Oldest waiting 1d'
	);
});

test('an unparseable since is ignored when choosing the oldest wait', () => {
	const asks = [ask('not-a-date'), ask('2026-11-21T21:00:00Z')];
	expect(stripCounts([], asks, now).needsYou).toEqual({
		label: 'Needs you',
		value: 2,
		sub: 'Oldest waiting 1h 30m'
	});
});

test('when no since parses the wait reads as Waiting', () => {
	const asks = [ask('not-a-date'), ask('')];
	expect(stripCounts([], asks, now).needsYou).toEqual({
		label: 'Needs you',
		value: 2,
		sub: 'Waiting'
	});
});
