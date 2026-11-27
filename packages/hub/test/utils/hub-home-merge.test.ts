import { expect, test } from 'vitest';
import { mergeHomeSnapshots } from '../../../reports/src/components/projects-sessions/hub-home/hubHomeMerge';
import {
	agentActivity,
	homeHeadline,
	isWorking
} from '../../../reports/src/components/projects-sessions/hub-home/hubHomePresentation';
import type {
	HomeAgent,
	HomePlan,
	HomeSubscription,
	OwnerHomeSnapshot
} from '../../../reports/src/lib/projects-sessions/hub-home/hubHome.types';

const agent = (id: string, state: HomeAgent['state'], since: string): HomeAgent => ({
	id,
	name: id,
	state,
	sessions: state === 'working' ? 1 : 0,
	tasks: [],
	subAgents: { sessions: 0, tasks: [] },
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

test('work synced between computers appears once, preserving artifacts at the same revision', () => {
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
	const plan: HomePlan = {
		id: 'plan',
		title: 'Fixture plan',
		project: null,
		state: 'draft',
		updatedAt: '2026-11-25T10:00:00Z',
		total: 0,
		done: 0,
		steps: []
	};
	primary.plans = [plan];
	const withDesign: HomePlan = {
		...plan,
		stage: 'design',
		planning: { promotions: [], artifacts: { design: { summary: 'Fixture design' } } }
	};
	second.plans = [withDesign];
	const merged = mergeHomeSnapshots([primary, second]);
	expect(merged?.plans).toEqual([withDesign]);
	const later = { ...plan, updatedAt: '2026-11-25T11:00:00Z' };
	primary.plans = [later];
	expect(mergeHomeSnapshots([second, primary])?.plans).toEqual([later]);
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
	expect(homeHeadline([agent('a', 'working', '2026-11-25T10:00:00Z')], 11)).toBe(
		'11 sessions running for 1 agent'
	);
	expect(homeHeadline([], 0, 2)).toBe('Nothing is running, 2 need you');
});

test('an agent with a flag and live runs still counts as working, and sessions are not summed across computers', () => {
	const live = (sessions: number, titles: string[]): HomeAgent => ({
		...agent('shared', 'needs-you', '2026-11-25T10:00:00Z'),
		sessions,
		tasks: titles.map((title) => ({ itemId: title, title, machine: null }))
	});
	const merged = mergeHomeSnapshots([
		snapshot([live(3, ['a', 'b', 'c'])], null),
		snapshot([live(2, ['c', 'd'])], null)
	]);
	expect(merged?.agents).toHaveLength(1);
	expect(merged?.agents[0]).toMatchObject({ sessions: 3, state: 'needs-you' });
	expect(merged?.agents[0].tasks.map((task) => task.title)).toEqual(['a', 'b', 'c', 'd']);
	expect(homeHeadline(merged?.agents ?? [], 0, 1)).toBe(
		'3 sessions running for 1 agent, 1 needs you'
	);
});

test('sub-agent sessions count once across computers and make their parent agent working', () => {
	const parent = (sessions: number): HomeAgent => ({
		...agent('cos', 'working', '2026-11-25T10:00:00Z'),
		sessions: 0,
		subAgents: {
			sessions,
			tasks: Array.from({ length: sessions }, (_, index) => ({
				itemId: `sub-${index}`,
				title: `Sub task ${index}`,
				machine: null
			}))
		}
	});
	const merged = mergeHomeSnapshots([snapshot([parent(3)], null), snapshot([parent(2)], null)]);
	expect(merged?.agents).toHaveLength(1);
	expect(merged?.agents[0].subAgents.sessions).toBe(3);
	expect(isWorking(merged!.agents[0])).toBe(true);
	expect(agentActivity(merged!.agents[0])).toBe(
		'3 sessions running (3 sub-agent sessions) · Synthetic task (+2 more)'
	);
	expect(homeHeadline(merged?.agents ?? [])).toBe('3 sessions running for 1 agent');
});
