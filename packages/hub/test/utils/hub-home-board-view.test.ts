import { describe, expect, test } from 'vitest';
import { buildHomeLiveOverview } from '../../../reports/src/lib/projects-sessions/hub-home/homeLiveOverview';
import {
	boardComputer,
	boardSessions,
	boardView
} from '../../../reports/src/components/projects-sessions/hub-home/hubHomeBoardView';
import {
	boardCardTime,
	boardComputerName,
	boardModel
} from '../../../reports/src/components/projects-sessions/hub-home/hubHomeBoardText';
import type { HomeOpenAsk } from '../../../reports/src/lib/projects-sessions/hub-home/hubHome.types';
import { boardNow, boardSources, item, run } from '../support/homeBoardSources';

const all = { project: '', search: '' };
const live = () =>
	buildHomeLiveOverview(
		boardSources(
			[
				item('waiting', { title: 'Write the guide', agent: 'docs' }),
				item('working', { status: 'in_progress' }),
				item('stuck', { status: 'blocked', priority: 'urgent', blocked_reason: 'waiting' }),
				item('asking', { status: 'blocked', priority: 'low', needs_daniel: true }),
				item('shipped', { status: 'done' })
			],
			[
				run(1, 'working'),
				run(2, 'asking', { state: 'finished', ended_at: boardNow }),
				run(3, 'shipped', { state: 'finished', ended_at: boardNow })
			]
		),
		boardNow
	);
const ask = (itemId: string, since: string): HomeOpenAsk => ({
	itemId,
	agentId: 'harness',
	agentName: 'harness',
	title: `Question on ${itemId}`,
	question: 'Which one?',
	options: [],
	since
});
const ids = (view: ReturnType<typeof boardView>, column: string) =>
	view.columns.find((entry) => entry.id === column)!.cards.map((card) => card.row.itemId);

describe('the columns Home draws', () => {
	test('questions lead Blocked, longest wait first, ahead of an urgent block', () => {
		const asks = [ask('later', '2026-11-28T18:00:00Z'), ask('asking', '2026-11-28T09:00:00Z')];

		expect(ids(boardView(live(), asks, all), 'blocked')).toEqual(['asking', 'later', 'stuck']);
	});

	test('a project filter and a search narrow every column', () => {
		const docs = boardView(live(), [], { project: 'docs', search: '' });
		expect(docs.columns.map((entry) => entry.total)).toEqual([1, 0, 0, 0]);
		const found = boardView(live(), [], { project: '', search: 'GUIDE' });
		expect(ids(found, 'todo')).toEqual(['waiting']);
		expect(found.columns.map((entry) => entry.total)).toEqual([1, 0, 0, 0]);
	});

	test('project chips count unfinished work, busiest first', () => {
		const view = boardView(live(), [], all);
		expect(view.projects).toEqual([
			{ name: 'harness', total: 3 },
			{ name: 'docs', total: 1 }
		]);
		expect(view.open).toBe(4);
		expect(view.partial).toBe(false);
	});

	test('tasks counted but not sent stay in the column total', () => {
		const sent = live();
		sent.board!.counts.find((count) => count.project === 'harness')!.done = 40;

		const done = boardView(sent, [], all).columns.find((entry) => entry.id === 'done')!;
		expect([done.cards.length, done.total]).toEqual([1, 40]);
	});

	test('an older Mac draws one card per task and says how many it did not list', () => {
		const old = live();
		delete old.board;
		const view = boardView(old, [], all);

		expect(view.partial).toBe(true);
		expect(ids(view, 'progress')).toEqual(['working']);
		expect(ids(view, 'done')).toEqual(['shipped']);
		const listed = view.columns.flatMap((entry) => entry.cards.map((card) => card.row.itemId));
		expect(new Set(listed).size).toBe(listed.length);
		const open = old.projects.reduce((sum, project) => sum + project.counts.open, 0);
		expect(view.unlistedOpen).toBe(open - ids(view, 'todo').length);
	});

	test('with no linked Mac only the questions are listed', () => {
		const view = boardView(undefined, [ask('asking', '2026-11-28T09:00:00Z')], all);
		expect(view.columns.map((entry) => entry.total)).toEqual([0, 0, 1, 0]);
		expect(view.partial).toBe(false);
	});
});

describe('the stats strip and card words', () => {
	test('running sessions are split by model family, with private ones counted', () => {
		const overview = buildHomeLiveOverview(
			boardSources(
				[item('a'), item('b'), item('c', { sensitive: true })],
				[run(1, 'a'), run(2, 'b', { model: 'gpt-6.2-sol' }), run(3, 'c')]
			),
			boardNow
		);
		expect(boardSessions(overview)).toEqual({
			total: 3,
			detail: '1 Claude · 1 Codex · 1 private'
		});
		expect(boardSessions(undefined)).toEqual({ total: 0, detail: 'Nothing running' });
	});

	test('a computer shows load only when it reported both load and cores', () => {
		const machine = { name: 'studio-mac', status: 'busy' as const };
		const loaded = { ...machine, resources: { loadOne: 6, cores: 8 } };

		expect(boardComputer(loaded, live())).toMatchObject({
			word: 'Busy',
			load: 75,
			detail: '1 session · 75% load'
		});
		expect(boardComputer(machine, live())).toMatchObject({ load: null, detail: '1 session' });
		expect(boardComputer({ ...loaded, status: 'offline' }, live())).toMatchObject({
			word: 'Offline',
			load: null,
			detail: 'Not reachable'
		});
	});

	test('models and computers read as names, and unknown ones are kept as recorded', () => {
		expect(boardModel('claude-sonnet-5-5:high')).toBe('Sonnet 5.5');
		expect(boardModel('gpt-6.2-sol')).toBe('Sol 6.2');
		expect(boardModel('local-model:low')).toBe('local-model');
		expect(boardModel(null)).toBeNull();
		expect(boardComputerName('daniel-primary-mbp')).toBe('Primary Mac');
		expect(boardComputerName('studio-mac')).toBe('studio-mac');
	});

	test('an ETA in the past says so instead of showing a stale time', () => {
		const [card] = boardView(live(), [], all).columns[1].cards;
		const due = new Date(boardNow - 60_000).toISOString();

		expect(boardCardTime({ ...card, due }, boardNow)).toBe('ETA passed');
		expect(boardCardTime({ ...card, due: null }, boardNow)).toMatch(/^Started \d\d:\d\d$/);
	});
});
