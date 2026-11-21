import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { TrackerItemReadRepository } from '../../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerLocalApiService } from '../../../src/services/projects-sessions/TrackerLocalApiService';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';

let database: DatabaseSync;
let store: TrackerPersistenceService;
let api: TrackerLocalApiService;

beforeEach(() => {
	database = new DatabaseSync(':memory:');
	store = new TrackerPersistenceService(database, 'fixture-mac', {
		now: () => Date.UTC(2026, 10, 21, 12)
	});
	api = new TrackerLocalApiService(store, new TrackerItemReadRepository(database), {
		now: () => Date.UTC(2026, 10, 21, 12)
	});
});

afterEach(() => database.close());

function request(path: string, method = 'GET', payload?: object | string) {
	return api.handle(
		new Request(`http://127.0.0.1:7700${path}`, {
			method,
			headers: { 'x-tracker-as': 'fixture-actor' },
			body: typeof payload === 'string' ? payload : JSON.stringify(payload)
		})
	);
}

test('commits item and notes under the actor, serves the overview feed and returns tombstones', async () => {
	const created = await request('/items', 'POST', { title: 'Fixture bridge rollout', due: 'today' });
	expect(created.status).toBe(201);
	const { id } = await created.json();
	expect(id).toMatch(/^[0-9a-z]{10}$/);
	const prefix = id.slice(0, 6);
	const noted = await request(`/items/${prefix}/progress`, 'POST', { text: 'Synthetic note' });
	expect(noted.status).toBe(200);
	expect(await noted.json()).toMatchObject({
		title: 'Fixture bridge rollout',
		status: 'in_progress',
		notes_log: [{ node: 'fixture-mac', text: 'Synthetic note' }]
	});
	expect(store.opsSince(0, 10).map((op) => op.actor)).toEqual(['fixture-actor', 'fixture-actor']);
	const overview = await request('/items?status=all&limit=-1');
	expect(await overview.json()).toMatchObject([{ id, status: 'in_progress' }]);
	const digest = await request('/digest?format=text');
	expect(digest.headers.get('content-type')).toBe('text/plain; charset=utf-8');
	expect(await digest.text()).toContain('Fixture bridge rollout');
	const removed = await request(`/items/${prefix}`, 'DELETE');
	expect(removed.status).toBe(200);
	expect(await removed.json()).toMatchObject({ id, deleted: true });
	expect((await request(`/items/${prefix}`)).status).toBe(404);
});

test('rejects duplicate and malformed inputs without changing the journal', async () => {
	const { id } = await (
		await request('/items', 'POST', { title: 'Unique fixture handoff' })
	).json();
	const duplicate = await request('/items', 'POST', { title: 'Unique fixture handoff' });
	expect(duplicate.status).toBe(409);
	expect(await duplicate.json()).toMatchObject({ code: 'open_duplicate', matches: [{ id }] });
	const check = await request('/check?text=Unique+fixture+handoff');
	expect(await check.json()).toMatchObject({ ignored: [], open: [{ id }] });
	const malformed = await request(`/items/${id}`, 'PATCH', '{');
	expect(malformed.status).toBe(400);
	expect(await malformed.json()).toEqual({ error: 'invalid JSON body' });
	expect((await request(`/items/${id}/launch`, 'POST')).status).toBe(404);
	expect(store.maxSeq()).toBe(1);
});

test('blocks, unblocks and reopens an item with durable notes', async () => {
	const { id } = await (
		await request('/items', 'POST', { title: 'Synthetic bridge review' })
	).json();
	const mark = (verb: string, body?: object) => request(`/items/${id}/${verb}`, 'POST', body);
	expect((await mark('unblock')).status).toBe(409);
	expect(await (await mark('block', { reason: 'Waiting for fixture' })).json()).toMatchObject({
		status: 'blocked',
		needs_daniel: true,
		question: 'Blocked: Waiting for fixture'
	});
	expect(await (await mark('unblock', { note: 'Available' })).json()).toMatchObject({
		status: 'in_progress',
		needs_daniel: false,
		notes_log: [{ text: 'blocked: Waiting for fixture' }, { text: 'unblocked: Available' }]
	});
	expect(await (await mark('done')).json()).toMatchObject({ status: 'done' });
	expect(await (await mark('reopen')).json()).toMatchObject({ status: 'open' });
});
