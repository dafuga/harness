import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { TrackerItemReadRepository } from '../../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerLocalApiService } from '../../../src/services/projects-sessions/TrackerLocalApiService';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';

let database: DatabaseSync;
let api: TrackerLocalApiService;
let now: number;

beforeEach(() => {
	now = Date.UTC(2026, 10, 25, 12);
	database = new DatabaseSync(':memory:');
	const store = new TrackerPersistenceService(database, 'fixture-mac', { now: () => now });
	api = new TrackerLocalApiService(store, new TrackerItemReadRepository(database), {
		now: () => now,
		planLaunch: (fields) => fields
	});
});

afterEach(() => database.close());

function call(path: string, method = 'GET', payload?: object) {
	return api.handle(
		new Request(`http://127.0.0.1:7700${path}`, {
			method,
			headers: { 'x-tracker-as': 'fixture-actor' },
			body: payload ? JSON.stringify(payload) : undefined
		})
	);
}

async function add(title: string, agent = 'fixture') {
	const response = await call('/items', 'POST', { title, agent });
	return (await response.json()).id as string;
}

test('sync puts a credential blocker on Needs Daniel once, and leaves a technical one with its owner', async () => {
	const credential = await add('Slack QA assistant');
	const technical = await add('Sync server');
	await call(`/items/${credential}/block`, 'POST', {
		reason: 'GitHub credential with Issues write is absent',
		needs_daniel: false
	});
	await call(`/items/${technical}/block`, 'POST', {
		reason: 'unit tests fail in the workers runtime',
		needs_daniel: false
	});
	database.prepare('UPDATE items SET needs_daniel = 0 WHERE id = ?').run(credential);
	const noteOnly = await add('Needs sandbox access');
	await call(`/items/${noteOnly}/start`, 'POST');
	await call(`/items/${noteOnly}/note`, 'POST', { text: 'Missing credential for the sandbox' });
	const before = await (await call('/blockers')).json();
	expect(before).toMatchObject({ total: 3, unescalated: 2 });

	const synced = await (await call('/blockers/sync', 'POST')).json();
	expect(synced).toMatchObject({ escalated: [credential], rechecked: [] });
	expect(synced.blockers.unescalated).toBe(1);
	const notes = synced.blockers.groups.flatMap(({ items }: { items: unknown[] }) => items);
	expect(notes).toContainEqual(expect.objectContaining({ id: noteOnly, kind: 'note' }));
	expect(await (await call(`/items/${noteOnly}`)).json()).toMatchObject({
		status: 'in_progress',
		needs_daniel: false
	});
	const item = await (await call(`/items/${credential}`)).json();
	expect(item).toMatchObject({
		needs_daniel: true,
		question: 'Blocked (Credential / access): GitHub credential with Issues write is absent'
	});
	const again = await (await call('/blockers/sync', 'POST')).json();
	expect(again.escalated).toEqual([]);
	const untouched = await (await call(`/items/${technical}`)).json();
	expect(untouched.needs_daniel).toBe(false);
});

test('sync chases the owner of a stale blocker once a day', async () => {
	const id = await add('Stuck work');
	await call(`/items/${id}/block`, 'POST', {
		reason: 'unit tests fail in the workers runtime',
		needs_daniel: false
	});
	now += 25 * 3_600_000;
	const first = await (await call('/blockers/sync', 'POST')).json();
	expect(first.rechecked).toEqual([id]);
	const second = await (await call('/blockers/sync', 'POST')).json();
	expect(second.rechecked).toEqual([]);
	now += 25 * 3_600_000;
	expect((await (await call('/blockers/sync', 'POST')).json()).rechecked).toEqual([id]);
});
