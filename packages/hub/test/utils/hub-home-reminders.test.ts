import { expect, test, vi } from 'vitest';
import {
	buildHomeSnapshot,
	noProviders
} from '../../../reports/src/lib/projects-sessions/hub-home/homeTrackerProjection';
import { buildHomeLiveOverview } from '../../../reports/src/lib/projects-sessions/hub-home/homeLiveOverview';
import {
	reminderNextTime,
	snoozeChoices
} from '../../../reports/src/lib/projects-sessions/hub-home/reminderTimes';
import type { TrackerItemRecord } from '../../../reports/src/lib/projects-sessions/project-overview/projectOverviewTracker.types';
import { deliverHomeChat } from '../../../desktop/src/lib/development-tooling/desktop-initialization/tracker-overview-publisher/homeTrackerChat';
import { mergeHomeSnapshots } from '../../../reports/src/components/projects-sessions/hub-home/hubHomeMerge';
import { showsHomeChatTarget } from '../../src/services/networking-security/linkedHomeChat';
import { serveHubHome } from '../../src/routes/api/hub-home/homePolicy';
import { overviewFixture } from '../support/trackerOverviewFixture';
import { homeRequest, id, payload, sheets } from '../support/hubHomeFixture';

const now = Date.parse('2026-11-26T12:00:00Z');
const updated_at = new Date(now).toISOString();
const at = '2026-11-29T10:00:00.000Z';
const weekly: TrackerItemRecord = {
	id: 'plant-1',
	title: 'WEEKLY personal reminder (Sundays 10:00): water the sample plant',
	status: 'open',
	agent: 'personal',
	updated_at,
	due: at,
	remindAt: at,
	every: '0 10 * * 0',
	kind: 'reminder'
};
const ask: TrackerItemRecord = {
	...weekly,
	id: 'hotel-1',
	title: 'Reminder 27 Nov 18:00: book a sample room',
	agent: 'dad',
	status: 'blocked',
	remindAt: '2026-11-27T18:00:00.000Z',
	every: null,
	kind: 'task',
	needs_daniel: true,
	question: 'Book it?',
	options: [
		{ label: 'Yes', effect: '', recommended: true },
		{ label: 'No', effect: '' }
	]
};
const hidden = { ...weekly, id: 'secret-1', sensitive: true };
const finished = { ...weekly, id: 'done-1', status: 'done' as const };
const plan = { ...weekly, id: 'plan-1', kind: 'plan', remindAt: null };
const sources = { items: [weekly, ask, hidden, finished, plan], runs: [], machines: [] };
const home = () => buildHomeSnapshot(sources, noProviders, now);

test('personal items are listed only as reminders, soonest first', () => {
	const snapshot = home();
	expect(snapshot.reminders).toEqual([
		{
			itemId: 'hotel-1',
			title: 'Book a sample room',
			at: ask.remindAt,
			repeats: null,
			updatedAt: updated_at
		},
		{
			itemId: 'plant-1',
			title: 'Water the sample plant',
			at,
			repeats: 'Weekly',
			updatedAt: updated_at
		}
	]);
	expect(snapshot.openAsks).toEqual([]);
	expect(snapshot.agents).toEqual([]);
	expect(snapshot.plans).toEqual([]);
	expect([...snapshot.scheduled, ...(snapshot.overdue ?? [])]).toEqual([]);
	expect(snapshot.overview).toMatchObject({ projects: [] });
	expect(buildHomeLiveOverview(sources, now).projects).toEqual([]);
});

test('done and snooze write only to a reminder still armed for the shown time', async () => {
	const fetcher = vi.fn<typeof fetch>(async () => Response.json({}));
	const tap = {
		id,
		agentId: 'personal',
		itemId: 'plant-1',
		question: null,
		text: 'Done',
		armed: at
	};
	const done = { ...tap, kind: 'reminder-done' as const };
	expect(await deliverHomeChat(done, home(), fetcher)).toMatchObject({ status: 'sent' });
	const until = '2026-11-30T09:00:00.000Z';
	const snooze = { ...tap, kind: 'reminder-snooze' as const, until };
	expect(await deliverHomeChat(snooze, home(), fetcher)).toMatchObject({ status: 'sent' });
	expect(fetcher.mock.calls.map(([url, init]) => [url, JSON.parse(String(init?.body))])).toEqual([
		['http://127.0.0.1:7701/items/plant-1/done', { occurrence: at, by: 'Daniel via Hub' }],
		['http://127.0.0.1:7701/items/plant-1/remind', { at: until, by: 'Daniel via Hub' }]
	]);
	const stale = { ...done, armed: '2026-11-22T10:00:00.000Z' };
	expect(await deliverHomeChat(stale, home(), fetcher)).toMatchObject({ status: 'refused' });
	expect(fetcher).toHaveBeenCalledTimes(2);
});

test('the Hub keeps reminders, queues a current tap and refuses a stale one', async () => {
	const { db, close } = await sheets();
	try {
		const fixture = overviewFixture();
		const serve = (request: Request) => serveHubHome(request, { ...fixture.homeDeps(), db });
		const cookie = await fixture.browser();
		const bearer = await fixture.native();
		const reminders = home().reminders;
		await serve(homeRequest('PUT', { bearer }, '', { ...payload, reminders }));
		const read = await (await serve(homeRequest('GET', { cookie }))).json();
		expect(read).toMatchObject({ snapshot: { reminders } });
		const tap = {
			id,
			agentId: 'personal',
			itemId: 'plant-1',
			kind: 'reminder-done',
			question: null,
			text: 'Done',
			armed: at
		};
		const post = (body: unknown) => serve(homeRequest('POST', { cookie }, '/chat', body));
		const stale = await post({ ...tap, armed: '2026-11-22T10:00:00.000Z' });
		expect(await stale.json()).toMatchObject({ status: 'refused' });
		expect((await post({ ...tap, armed: undefined })).status).toBe(400);
		expect((await post({ ...tap, kind: 'reminder-snooze' })).status).toBe(400);
		expect((await post(tap)).status).toBe(202);
	} finally {
		await close();
	}
});

test('a reminder two computers list shows once, as its newest copy', () => {
	const older = home();
	const newer = {
		...older,
		reminders: older.reminders!.map((entry) => ({
			...entry,
			at,
			updatedAt: '2026-11-26T13:00:00.000Z'
		}))
	};
	expect(mergeHomeSnapshots([older, newer])?.reminders).toEqual(newer.reminders);
	const silent = { ...older, reminders: undefined };
	expect(mergeHomeSnapshots([silent, silent])?.reminders).toBeUndefined();
});

test('a linked computer takes a tap only for a reminder it shows at that time', () => {
	const tap = {
		id,
		agentId: 'personal',
		itemId: 'plant-1',
		kind: 'reminder-done' as const,
		question: null,
		text: 'Done',
		armed: at
	};
	expect(showsHomeChatTarget(home(), tap)).toBe(true);
	expect(showsHomeChatTarget(home(), { ...tap, armed: '2026-11-22T10:00:00.000Z' })).toBe(false);
	expect(showsHomeChatTarget({ ...home(), reminders: undefined }, tap)).toBe(false);
});

test('next times name the day, mark a passed one due and offer three snoozes', () => {
	const noon = new Date(2026, 10, 26, 12).getTime();
	const local = (day: number, clock: number) => new Date(2026, 10, day, clock).toISOString();
	expect(reminderNextTime(local(26, 18), noon)).toEqual({ due: false, label: 'Today 18:00' });
	expect(reminderNextTime(local(27, 9), noon).label).toBe('Tomorrow 09:00');
	expect(reminderNextTime(local(29, 10), noon).label).toBe('Sun 29 Nov 10:00');
	expect(reminderNextTime(local(25, 9), noon)).toEqual({ due: true, label: 'Due now' });
	expect(reminderNextTime(local(26, 12), noon)).toEqual({ due: true, label: 'Due now' });
	expect(snoozeChoices(noon).map((choice) => choice.until)).toEqual([
		local(26, 13),
		local(27, 9),
		new Date(2026, 11, 3, 12).toISOString()
	]);
});
