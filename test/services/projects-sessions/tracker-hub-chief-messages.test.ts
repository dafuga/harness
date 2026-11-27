import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { trackerRunSchema } from '../../../src/repositories/projects-sessions/tracker-dispatch-repository/trackerRunSchema';
import { TrackerItemReadRepository } from '../../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerLocalApiService } from '../../../src/services/projects-sessions/TrackerLocalApiService';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';
import type {
	TrackerChiefChannel,
	TrackerDeliveryResult
} from '../../../src/services/projects-sessions/TrackerNotificationService';
import { trackerHubChiefDelivery } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerHubChiefMessages';
import { hubSessionMessages } from '../../../src/utils/projects-sessions/hubSessionMessages';

/**
 * Chief of Staff no longer runs in a tmux pane, so its Hub messages go through the hub's Chief of
 * Staff notification channel (the digest's destination), with an honest receipt for every outcome.
 */
let database: DatabaseSync;
let store: TrackerPersistenceService;
let items: TrackerItemReadRepository;
let api: TrackerLocalApiService;
let now: number;
const uuid = '1a2b3c4d-0000-4000-8000-000000000001';

beforeEach(() => {
	now = Date.UTC(2026, 10, 26, 20);
	database = new DatabaseSync(':memory:');
	store = new TrackerPersistenceService(database, 'fixture-hub', { now: () => now });
	database.exec(trackerRunSchema);
	items = new TrackerItemReadRepository(database);
	api = new TrackerLocalApiService(store, items, { now: () => now });
});

afterEach(() => database.close());

async function post(path: string, payload: object, actor = 'Daniel via Hub') {
	const request = new Request(`http://127.0.0.1:7701${path}`, {
		method: 'POST',
		headers: { 'x-tracker-as': actor },
		body: JSON.stringify(payload)
	});
	return (await api.handle(request)).json();
}

function thread(itemId: string) {
	return hubSessionMessages(items.getStored(itemId).notes_log);
}

function channel(...results: TrackerDeliveryResult[]) {
	const send = vi.fn(async ({ id }: { id: string }) => ({
		attempt: `hub_message|${id}`,
		result: results.shift() ?? { status: 'sent' as const }
	}));
	return { send } satisfies TrackerChiefChannel;
}

test('a Chief of Staff message is sent once through its channel, delivered with the attempt id, then replied', async () => {
	const { id, item } = await post('/messages', { id: uuid, target: 'cos', text: 'Ship it' });
	const chief = channel({ status: 'rejected', error: 'Digest session is not idle', busy: true });
	const deliver = trackerHubChiefDelivery({ store, channel: () => chief, now: () => now });

	await deliver();
	expect(chief.send).toHaveBeenCalledExactlyOnceWith({
		id,
		itemId: item,
		text: expect.stringMatching(
			new RegExp(`^Message from Daniel via Hub \\(${id}\\): Ship it .*tracker reply ${id} `)
		)
	});
	expect(thread(item)).toMatchObject([
		{ status: 'stored', reason: 'Chief of Staff channel: Digest session is not idle' }
	]);

	await deliver();
	expect(chief.send).toHaveBeenCalledTimes(1);
	now += 20_000;
	await deliver();
	expect(chief.send).toHaveBeenCalledTimes(2);
	expect(thread(item)).toMatchObject([
		{ status: 'delivered', session: 'chief-of-staff-channel', attempt: `hub_message|${id}` }
	]);
	expect(thread(item)[0]).not.toHaveProperty('reason');
	now += 20_000;
	await deliver();
	expect(chief.send).toHaveBeenCalledTimes(2);

	await post(`/messages/${id}/reply`, { text: 'On it.' }, 'cos');
	expect(thread(item)).toMatchObject([{ status: 'acknowledged', replies: [{ text: 'On it.' }] }]);
});

test('with no Chief of Staff channel the message is refused with that reason, never left stored', async () => {
	const { item } = await post('/messages', { id: uuid, target: 'cos', text: 'Anyone there?' });
	await trackerHubChiefDelivery({ store, channel: () => undefined, now: () => now })();
	expect(thread(item)).toMatchObject([
		{ status: 'refused', reason: 'Chief of Staff channel not configured' }
	]);
});

test('a channel that rejects outright refuses it; a thrown send retries with the same id', async () => {
	const { id, item } = await post('/messages', { id: uuid, target: 'cos', text: 'Hello' });
	const flaky = { send: vi.fn().mockRejectedValueOnce(new Error('socket hang up')) };
	flaky.send.mockResolvedValueOnce({
		attempt: `hub_message|${id}`,
		result: { status: 'rejected', error: 'HTTP 410' }
	});
	const deliver = trackerHubChiefDelivery({ store, channel: () => flaky, now: () => now });
	await deliver();
	expect(thread(item)).toMatchObject([{ status: 'stored' }]);
	now += 20_000;
	await deliver();
	expect(flaky.send.mock.calls.map(([message]) => message.id)).toEqual([id, id]);
	expect(thread(item)).toMatchObject([
		{ status: 'refused', reason: 'Chief of Staff channel: HTTP 410' }
	]);
});

test('session messages are left to the computer that runs them', async () => {
	const task = await post('/items', { title: 'Fixture task', agent: 'harbor' });
	database
		.prepare(
			`INSERT INTO runs(id,item_id,rung,cli,model,state,queued_at,started_at,tmux)
			 VALUES (4,?,'sonnet','claude','claude-sonnet-5-5','running',?,?,'auto-r4')`
		)
		.run(task.id, now, now);
	await post('/messages', {
		id: uuid,
		target: { item: task.id, node: 'fixture-hub', run: 4 },
		text: 'Rebase'
	});
	const chief = channel();
	await trackerHubChiefDelivery({ store, channel: () => chief, now: () => now })();
	expect(chief.send).not.toHaveBeenCalled();
});
