import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { TrackerItemReadRepository } from '../../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerLocalApiService } from '../../../src/services/projects-sessions/TrackerLocalApiService';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';
import { trackerAnswerDelivery } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerAnswerDelivery';
import { trackerChiefReviewAlerts } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerChiefReviewQueue';

let clock = Date.UTC(2026, 10, 26, 12);
const now = () => ++clock;
const question = 'May we deploy the fixture?';
const options = [
	{ label: 'Deploy', effect: 'Ship the fixture.', recommended: true },
	{ label: 'Hold', effect: 'Keep the old fixture.' }
];
const ask = { question, options, confirm: 'deploy' };
const blocker = 'Waiting on Daniel for fixture access';
const published = { needs_daniel: true, resolved: false, question, confirm: 'deploy' };

let database: DatabaseSync;
let store: TrackerPersistenceService;
let api: TrackerLocalApiService;
let id: string;

beforeEach(async () => {
	database = new DatabaseSync(':memory:');
	store = new TrackerPersistenceService(database, 'fixture-mac', { now, chiefReview: 'local' });
	api = new TrackerLocalApiService(store, new TrackerItemReadRepository(database), { now });
	id = (await send('/items', { title: 'Synthetic release' })).body.id;
	await mark('flag', ask, 'Chief of Staff');
});
afterEach(() => database.close());

async function send(path: string, body?: object, actor?: string) {
	const response = await api.handle(
		new Request(`http://tracker.local${path}`, {
			method: body ? 'POST' : 'GET',
			headers: actor ? { 'x-tracker-as': actor } : {},
			body: body && JSON.stringify(body)
		})
	);
	return { status: response.status, body: await response.json() };
}
const mark = (verb: string, body: object, actor = 'auto-worker-r1') =>
	send(`/items/${id}/${verb}`, body, actor);
const read = async () => (await send(`/items/${id}`)).body;
const queued = () => trackerChiefReviewAlerts(store);

test('a session repeating the released ask word for word changes nothing', async () => {
	expect((await mark('flag', ask)).status).toBe(200);
	expect(await read()).toMatchObject(published);
	expect((await read()).review_status).toBeUndefined();
	expect(queued()).toEqual([]);
});

test('a Tracker plumbing ask never withdraws a released ask', async () => {
	await mark('flag', { question: 'auto-launch of the fixture failed twice' }, 'Tracker');
	expect(await read()).toMatchObject({ ...published, options });
	expect(queued()).toHaveLength(1);
});

test.each([
	['a held blocker', 'block', { reason: blocker }, 'auto-worker-r1'],
	['a held plumbing ask', 'flag', { question: 'auto-launch failed twice' }, 'Tracker']
])('a Chief of Staff answer to %s leaves the released ask open', async (_, verb, body, actor) => {
	await mark(verb, body, actor);
	const reply = await mark('answer', { answer: 'Use the test account' }, 'Chief of Staff');
	expect(reply.status).toBe(200);
	expect(await read()).toMatchObject({ ...published, options, answer: null });
	expect(queued()).toEqual([]);
	expect((await send(`/review/${id}`)).body).toMatchObject({ answer: 'Use the test account' });
});

test('a Chief of Staff resolve of a held blocker leaves the released ask open', async () => {
	await mark('block', { reason: blocker });
	expect((await mark('resolve', {}, 'Chief of Staff')).status).toBe(200);
	expect(await read()).toMatchObject(published);
	expect(queued()).toEqual([]);
});

test('Daniel answers the ask he sees, with its confirm step, while a blocker is held', async () => {
	await mark('block', { reason: blocker });
	expect((await mark('answer', { option: 1 }, 'Daniel')).status).toBe(409);
	const confirmed = await mark('answer', { option: 1, confirmed: true }, 'Daniel');
	expect(confirmed.status).toBe(200);
	expect(await read()).toMatchObject({ needs_daniel: false, resolved: true, answer: 'Deploy' });
});

test('a private answer beside a released ask still reaches its session', async () => {
	await mark('block', { reason: blocker });
	await mark('answer', { answer: 'Use the test account' }, 'Chief of Staff');
	database.exec(
		`CREATE TABLE IF NOT EXISTS runs (id INTEGER PRIMARY KEY, item_id TEXT, node TEXT, tmux TEXT,
		cli TEXT, state TEXT, outcome TEXT, started_at INTEGER, watch_pane TEXT, attempt INTEGER)`
	);
	database
		.prepare(
			`INSERT INTO runs (item_id, node, tmux, cli, state, started_at, attempt)
			VALUES (?, 'fixture-mac', 'auto-worker-r1', 'claude', 'running', 1, 1)`
		)
		.run(id);
	const deliver = vi.fn(async () => 'delivered' as const);
	const delivery = trackerAnswerDelivery(store, { deliver } as never, now, false);
	await delivery(new AbortController().signal);
	expect(deliver).toHaveBeenCalledWith(
		expect.objectContaining({ message: expect.stringContaining(`tracker review ${id}`) }),
		expect.anything()
	);
});
