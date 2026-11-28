import { describe, expect, test } from 'vitest';
import {
	dockActivity,
	dockPillText,
	dockSummary,
	dockWait,
	hubDockModel
} from '../../../reports/src/components/projects-sessions/hub-home/hubDockModel';
import type {
	HomeAgent,
	HomeOpenAsk
} from '../../../reports/src/lib/projects-sessions/hub-home/hubHome.types';
import { hubDockPage } from '../../src/utils/networking-security/hubDockPage';

const now = Date.parse('2026-11-28T18:00:00Z');
const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

function agent(id: string, more: Partial<HomeAgent> = {}): HomeAgent {
	return {
		id,
		name: id,
		state: 'idle',
		sessions: 0,
		tasks: [],
		subAgents: { sessions: 0, tasks: [] },
		itemId: `item-${id}`,
		task: `${id} task`,
		machine: null,
		model: null,
		since: ago(5),
		question: null,
		messages: [],
		...more
	};
}

function ask(agentId: string, minutes: number, question = `${agentId}?`): HomeOpenAsk {
	return {
		itemId: `ask-${agentId}-${minutes}`,
		agentId,
		agentName: agentId,
		title: question,
		question,
		options: [],
		since: ago(minutes)
	};
}

describe('agents dock model', () => {
	test('lists each asking agent once, the longest wait first, with its oldest question', () => {
		const model = hubDockModel(
			{
				agents: [agent('cos', { sessions: 1 }), agent('builder', { sessions: 1 })],
				asks: [agent('notes'), agent('shop')],
				openAsks: [ask('shop', 12), ask('notes', 46, 'second'), ask('notes', 134, 'first')]
			},
			now
		);
		expect(model.asking.map((row) => [row.agent.id, row.line])).toEqual([
			['notes', 'first'],
			['shop', 'shop?']
		]);
		expect(model.working.map((row) => row.agent.id)).toEqual(['cos', 'builder']);
		expect(dockPillText(model)).toBe('2 have questions');
		expect(dockSummary(model)).toBe('2 have questions · 2 working');
	});

	test('keeps an asking agent out of Working and leaves idle agents to New conversation', () => {
		const model = hubDockModel(
			{
				agents: [agent('builder', { sessions: 2 }), agent('idle')],
				asks: [],
				openAsks: [ask('builder', 3)]
			},
			now
		);
		expect(model.working).toEqual([]);
		expect(model.reachable.map((entry) => entry.id)).toEqual(['cos', 'builder', 'idle']);
		expect(dockPillText(model)).toBe('1 has a question');
		expect(dockSummary(model)).toBe('1 has a question · 0 working');
	});

	test('always reaches Chief of Staff and says so when nothing is happening', () => {
		const model = hubDockModel({ agents: [], asks: [], openAsks: [] }, now);
		expect(model.reachable.map((entry) => entry.name)).toEqual(['Chief of Staff']);
		expect(dockPillText(model)).toBeNull();
		expect(dockSummary(model)).toBe('No questions · 0 working');
	});

	test('says what a working agent does', () => {
		const watching = agent('cos', { subAgents: { sessions: 7, tasks: [] } });
		expect(dockActivity(watching)).toBe('Watching 7 sessions');
		const busy = agent('builder', {
			sessions: 3,
			tasks: [{ itemId: 'a', title: 'Board view', machine: null }]
		});
		expect(dockActivity(busy)).toBe('Board view (+2 more)');
		const working = hubDockModel({ agents: [watching], asks: [], openAsks: [] }, now);
		expect(dockPillText(working)).toBe('1 working');
	});

	test('shows a wait in its two largest units', () => {
		expect(dockWait(ago(0), now)).toBe('0m');
		expect(dockWait(ago(46), now)).toBe('46m');
		expect(dockWait(ago(134), now)).toBe('2h 14m');
		expect(dockWait(ago(1440 * 3 + 240), now)).toBe('3d 4h');
	});

	test('docks on signed-in pages only', () => {
		for (const id of ['/', '/projects', '/(accounts-access)/devices', '/tracker-overview'])
			expect(hubDockPage(id)).toBe(true);
		for (const id of ['/(public-site)/about', '/native/[handoffId]', '/invite/[projectId]', null])
			expect(hubDockPage(id)).toBe(false);
	});
});
