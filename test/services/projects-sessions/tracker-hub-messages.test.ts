import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { trackerRunSchema } from '../../../src/repositories/projects-sessions/tracker-dispatch-repository/trackerRunSchema';
import { TrackerItemReadRepository } from '../../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerRunReadRepository } from '../../../src/repositories/projects-sessions/TrackerRunReadRepository';
import { TrackerLocalApiService } from '../../../src/services/projects-sessions/TrackerLocalApiService';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';
import { trackerHubMessageDelivery } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerHubMessages';
import type { TrackerWatchdogPort } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerWatchdogPort.types';
import { hubSessionMessages } from '../../../src/utils/projects-sessions/hubSessionMessages';

/**
 * A Hub message is stored as notes on its thread item, typed by the computer that owns the pane
 * into exactly that pane, and answered with a reply keyed to its id.
 */
let database: DatabaseSync;
let store: TrackerPersistenceService;
let items: TrackerItemReadRepository;
let api: TrackerLocalApiService;
let now: number;
const node = 'fixture-mac';
const uuid = '1a2b3c4d-0000-4000-8000-000000000001';
const signal = new AbortController().signal;

beforeEach(() => {
	now = Date.UTC(2026, 10, 26, 17);
	database = new DatabaseSync(':memory:');
	store = new TrackerPersistenceService(database, node, { now: () => now });
	database.exec(trackerRunSchema);
	items = new TrackerItemReadRepository(database);
	api = new TrackerLocalApiService(store, items, {
		now: () => now,
		runs: new TrackerRunReadRepository(database, node)
	});
});

afterEach(() => database.close());

function request(path: string, payload?: object, actor = 'Daniel via Hub') {
	return api.handle(
		new Request(`http://127.0.0.1:7701${path}`, {
			method: 'POST',
			headers: { 'x-tracker-as': actor },
			body: JSON.stringify(payload ?? {})
		})
	);
}

async function task(title = 'Fixture session task') {
	return (await (await request('/items', { title, agent: 'harbor' })).json()).id as string;
}

function run(id: number, itemId: string, state = 'running', tmux = `auto-${itemId}-r${id}`) {
	database
		.prepare(
			`INSERT INTO runs(id,item_id,rung,cli,model,state,queued_at,started_at,ended_at,tmux)
			 VALUES (?,?,'sonnet','claude','claude-sonnet-5-5',?,?,?,?,?)`
		)
		.run(id, itemId, state, now, now, state === 'running' ? null : now, tmux);
}

function thread(itemId: string) {
	return hubSessionMessages(items.getStored(itemId).notes_log);
}

function port(result: 'delivered' | 'busy' | 'missing' = 'delivered') {
	const deliver = vi.fn(async () => result);
	const driver: TrackerWatchdogPort = {
		scan: async () => [],
		nudge: async () => false,
		send: async () => false,
		deliver
	};
	return { driver, deliver };
}

test('a message to Chief of Staff needs no item, is stored once and is never typed into a pane', async () => {
	const stored = await request('/messages', { id: uuid, target: 'cos', text: 'Ship the\nrelease' });
	expect(stored.status).toBe(201);
	const receipt = await stored.json();
	expect(receipt).toMatchObject({ status: 'stored', id: expect.stringMatching(/-1a2b3c4d$/) });
	const again = await request('/messages', { id: uuid, target: 'cos', text: 'Ship the\nrelease' });
	expect(await again.json()).toEqual(receipt);
	const chat = items.getStored(receipt.item);
	expect(chat).toMatchObject({ agent: 'cos', kind: 'plan', title: 'Hub chat with Chief of Staff' });
	expect(thread(receipt.item)).toMatchObject([
		{ id: receipt.id, text: 'Ship the release', status: 'stored', target: { kind: 'cos' } }
	]);

	// Chief of Staff is reached through its notification channel on the hub, not the cos pane.
	const pane = port();
	await trackerHubMessageDelivery({ store, driver: pane.driver, now: () => now })(signal);
	expect(pane.deliver).not.toHaveBeenCalled();
	expect(thread(receipt.item)).toMatchObject([{ status: 'stored' }]);
});

test('a session message goes only to that exact live run, on the computer that runs it', async () => {
	const itemId = await task();
	run(7, itemId);
	const target = { item: itemId, node, run: 7 };
	const { id } = await (
		await request('/messages', { id: uuid, target, text: 'Rebase first' })
	).json();
	const busy = port('busy');
	await trackerHubMessageDelivery({ store, driver: busy.driver, now: () => now })(signal);
	expect(thread(itemId)).toMatchObject([{ id, status: 'stored' }]);

	const live = port();
	now += 60_000;
	await trackerHubMessageDelivery({ store, driver: live.driver, now: () => now })(signal);
	expect(live.deliver).toHaveBeenCalledExactlyOnceWith(
		{ session: `auto-${itemId}-r7`, message: expect.stringContaining('Rebase first') },
		signal
	);
	expect(thread(itemId)).toMatchObject([{ id, status: 'delivered', session: `auto-${itemId}-r7` }]);

	const other = await request('/messages', {
		id: '9f9f9f9f-0000-4000-8000-000000000002',
		target: { item: itemId, node: 'other-mac', run: 3 },
		text: 'For the other computer'
	});
	expect(other.status).toBe(201);
	const remote = port();
	await trackerHubMessageDelivery({ store, driver: remote.driver, now: () => now })(signal);
	expect(remote.deliver).not.toHaveBeenCalled();
});

test('a replaced or ended run is refused and never handed to another session', async () => {
	const itemId = await task();
	run(7, itemId, 'finished');
	run(8, itemId);
	const known = await request('/messages', {
		id: uuid,
		target: { item: itemId, node, run: 7 },
		text: 'Too late'
	});
	expect(known.status).toBe(409);
	expect(await known.json()).toMatchObject({ status: 'refused' });

	// Stored while the run was live, then the run was replaced before delivery.
	database.prepare(`UPDATE runs SET state = 'running', ended_at = NULL WHERE id = 7`).run();
	const { id } = await (
		await request('/messages', { id: uuid, target: { item: itemId, node, run: 7 }, text: 'Hi' })
	).json();
	database.prepare(`UPDATE runs SET state = 'finished', ended_at = ? WHERE id = 7`).run(now);
	const { driver, deliver } = port();
	await trackerHubMessageDelivery({ store, driver, now: () => now })(signal);
	expect(deliver).not.toHaveBeenCalled();
	expect(thread(itemId)).toMatchObject([
		{ id, status: 'refused', reason: expect.stringContaining('run 7') }
	]);
});

test('messages and replies are checked before anything is written', async () => {
	const itemId = await task();
	expect((await request('/messages', { id: 'nope', target: 'cos', text: 'x' })).status).toBe(400);
	expect((await request('/messages', { id: uuid, target: 'cos', text: '  ' })).status).toBe(400);
	expect(
		(await request('/messages', { id: uuid, target: { item: itemId, node, run: 1.5 }, text: 'x' }))
			.status
	).toBe(400);
	expect((await request(`/messages/${itemId}-00000000/reply`, { text: 'x' })).status).toBe(404);
	expect((await request('/messages/not-an-id/reply', { text: 'x' })).status).toBe(400);
	expect(items.getStored(itemId).notes_log).toEqual([]);
});
