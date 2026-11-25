import { expect, test } from 'vitest';
import { mergeHomeSnapshots } from '../../src/components/projects-sessions/hubHomeMerge';
import { homeHeadline } from '../../src/components/projects-sessions/hubHomePresentation';
import type {
	HomeAgent,
	HomeSubscription,
	OwnerHomeSnapshot
} from '../../../reports/src/lib/projects-sessions/hub-home/hubHome.types';

const agent = (id: string, state: HomeAgent['state'], since: string): HomeAgent => ({
	id,
	name: id,
	state,
	itemId: null,
	task: 'Synthetic task',
	machine: null,
	model: null,
	since,
	question: null,
	messages: []
});
const quota = (id: string, readAt: string): HomeSubscription => ({
	id,
	provider: 'claude',
	plan: null,
	account: null,
	readAt,
	limits: [],
	credits: null,
	history: [],
	agents: []
});
const snapshot = (
	agents: HomeAgent[],
	subscriptions: HomeSubscription[] | null,
	liveSessions = 0
): OwnerHomeSnapshot => ({
	overview: { status: 'ready', projects: [], machines: [], liveSessions },
	agents,
	plans: [],
	scheduled: [],
	providers: { routines: null, quota: subscriptions }
});

test('no computer answering gives no Home view, and one computer is shown unchanged', () => {
	expect(mergeHomeSnapshots([])).toBeNull();
	const only = snapshot([agent('a', 'working', '2026-11-25T10:00:00Z')], null);
	expect(mergeHomeSnapshots([only])).toBe(only);
});

test('work synced between computers appears once, most urgent and most recent first', () => {
	const primary = snapshot(
		[
			agent('shared', 'idle', '2026-11-25T10:00:00Z'),
			agent('only-primary', 'working', '2026-11-25T10:00:00Z')
		],
		[quota('claude-a', '2026-11-25T10:00:00Z')],
		2
	);
	const second = snapshot(
		[
			agent('shared', 'needs-you', '2026-11-25T09:00:00Z'),
			agent('only-second', 'idle', '2026-11-25T10:00:00Z')
		],
		[quota('claude-a', '2026-11-25T11:00:00Z'), quota('codex-b', '2026-11-25T11:00:00Z')],
		5
	);
	const merged = mergeHomeSnapshots([primary, second]);
	expect(merged?.agents.map((entry) => [entry.id, entry.state])).toEqual([
		['shared', 'needs-you'],
		['only-primary', 'working'],
		['only-second', 'idle']
	]);
	expect(merged?.providers.quota?.map((entry) => [entry.id, entry.readAt])).toEqual([
		['claude-a', '2026-11-25T11:00:00Z'],
		['codex-b', '2026-11-25T11:00:00Z']
	]);
	expect(merged?.overview).toMatchObject({ status: 'ready', liveSessions: 5 });
});

test('quota stays unknown unless a computer reports it, and a failed overview never wins', () => {
	const none = snapshot([], null);
	const down: OwnerHomeSnapshot = { ...snapshot([], null), overview: { status: 'unavailable' } };
	const merged = mergeHomeSnapshots([down, none]);
	expect(merged?.providers.quota).toBeNull();
	expect(merged?.overview.status).toBe('ready');
});

test('the headline reflects running sessions even before any agent card exists', () => {
	expect(homeHeadline([])).toBe('Nothing is running yet');
	expect(homeHeadline([], 11)).toBe('11 sessions running');
	expect(homeHeadline([agent('a', 'working', '2026-11-25T10:00:00Z')], 11)).toBe('1 agent working');
});
