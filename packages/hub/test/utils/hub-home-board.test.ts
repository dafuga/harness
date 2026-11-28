import { afterEach, describe, expect, test, vi } from 'vitest';
import { parseLinkedHome } from '../../src/routes/api/hub-home/homeLivePayload';
import { buildHomeLiveOverview } from '../../../reports/src/lib/projects-sessions/hub-home/homeLiveOverview';
import { homeBoardCardsPerProject } from '../../../reports/src/lib/projects-sessions/hub-home/homeBoardCards';
import type {
	TrackerItemRecord,
	TrackerRunRecord
} from '../../../reports/src/lib/projects-sessions/project-overview/projectOverviewTracker.types';
import { recordedTracker } from '../support/recordedTracker';
import { recordedMacAnswer } from '../support/recordedTrackerMac';
import { boardNow, boardSources, item, run } from '../support/homeBoardSources';

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

const overview = (items: TrackerItemRecord[], runs: TrackerRunRecord[] = []) =>
	buildHomeLiveOverview(boardSources(items, runs), boardNow);
const columns = (items: TrackerItemRecord[], runs: TrackerRunRecord[] = []) =>
	Object.fromEntries(overview(items, runs).board!.cards.map((c) => [c.row.itemId, c.column]));

describe('the board the linked Mac sends', () => {
	test('each task sits in the column its status and live run put it in', () => {
		expect(
			columns(
				[
					item('open1', { status: 'open' }),
					item('live1', { status: 'in_progress' }),
					item('stuck', { status: 'blocked', blocked_reason: 'waiting on live1' }),
					item('done1', { status: 'done' })
				],
				[run(1, 'live1')]
			)
		).toEqual({ open1: 'todo', live1: 'progress', stuck: 'blocked', done1: 'done' });
	});

	test('private, ignored and deleted tasks never reach the board or its counts', () => {
		const board = overview([
			item('secret', { status: 'open', sensitive: true }),
			item('skip', { status: 'ignored' as TrackerItemRecord['status'] }),
			item('gone', { status: 'open', deleted: true }),
			item('kept', { status: 'open' })
		]).board!;

		expect(board.cards.map((card) => card.row.itemId)).toEqual(['kept']);
		expect(board.counts).toEqual([
			{ project: 'harness', todo: 1, progress: 0, blocked: 0, done: 0 }
		]);
	});

	test('finished work older than a week is left out', () => {
		const updated_at = new Date(boardNow - 8 * 86_400_000).toISOString();
		expect(columns([item('old', { status: 'done', updated_at })])).toEqual({});
	});

	test('a long column sends its most urgent cards and still counts every task', () => {
		const many = Array.from({ length: homeBoardCardsPerProject + 4 }, (_, index) =>
			item(`open${index}`, { status: 'open', priority: index === 18 ? 'urgent' : 'normal' })
		);
		const board = overview(many).board!;

		expect(board.cards).toHaveLength(homeBoardCardsPerProject);
		expect(board.cards[0]).toMatchObject({ priority: 'urgent', row: { itemId: 'open18' } });
		expect(board.counts[0].todo).toBe(many.length);
	});

	test('a card links the newest pull request and says merged only when a note does', () => {
		const at = new Date(boardNow).toISOString();
		const link = (n: number) => `https://github.com/example/app/pull/${n}`;
		const [merged, open] = overview([
			item('a', {
				status: 'open',
				priority: 'urgent',
				notes_log: [
					{ at, text: `PR ${link(7)} open` },
					{ at, text: 'Merged PR #7 after checks.' }
				]
			}),
			item('b', {
				status: 'open',
				notes_log: [
					{ at, text: `PR ${link(3)} merged` },
					{ at, text: `Follow-up ${link(9)} in review` }
				]
			})
		]).board!.cards;

		expect(merged.pr).toEqual({ number: 7, url: link(7), merged: true });
		expect(open.pr).toEqual({ number: 9, url: link(9) });
		expect(merged.notes![0].text).toBe('Merged PR #7 after checks.');
	});

	test('finished cards carry no notes', () => {
		const notes_log = [{ at: new Date(boardNow).toISOString(), text: 'All checks passed.' }];
		const [card] = overview([item('done1', { status: 'done', notes_log })]).board!.cards;
		expect(card.notes).toBeUndefined();
	});
});

describe('what the Hub accepts from a linked Mac', () => {
	const live = () =>
		overview([item('open1', { status: 'open' }), item('done1', { status: 'done' })]);
	/** The recorded Mac answer with this overview in it, as it travels. */
	async function parsed(liveOverview: unknown) {
		const tracker = recordedTracker();
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(Date.parse(tracker.recordedAt));
		const answer = await recordedMacAnswer(tracker);
		const sent = JSON.parse(JSON.stringify({ ...answer, liveOverview }));
		return (parseLinkedHome(sent) as { liveOverview?: ReturnType<typeof live> }).liveOverview;
	}

	test('a board arrives as the Mac built it', async () => {
		const sent = live();
		expect((await parsed(sent))!.board).toEqual(JSON.parse(JSON.stringify(sent.board)));
	});

	test('a board with a link outside GitHub pull requests is dropped, keeping the rows', async () => {
		const sent = live();
		sent.board!.cards[0].pr = { number: 1, url: 'https://evil.example/pull/1' };
		const result = (await parsed(sent))!;

		expect(result.board).toBeUndefined();
		expect(result.projects).toHaveLength(1);
	});

	test('an older Mac that sends no board is still read', async () => {
		const sent = live();
		delete sent.board;
		expect((await parsed(sent))!.projects).toHaveLength(1);
	});
});
