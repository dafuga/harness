import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { TrackerItemReadRepository } from '../../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerLocalApiService } from '../../../src/services/projects-sessions/TrackerLocalApiService';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';

const now = () => Date.UTC(2026, 10, 21, 12);
let database: DatabaseSync;
let api: TrackerLocalApiService;
beforeEach(() => {
	database = new DatabaseSync(':memory:');
	const store = new TrackerPersistenceService(database, 'fixture-mac', {
		now,
		chiefReview: 'local'
	});
	api = new TrackerLocalApiService(store, new TrackerItemReadRepository(database), { now });
});
afterEach(() => database.close());

async function request(path: string, method = 'GET', body?: object, actor?: string) {
	const response = await api.handle(
		new Request(`http://tracker.local${path}`, {
			method,
			headers: actor ? { 'x-tracker-as': actor } : {},
			body: body && JSON.stringify(body)
		})
	);
	return response;
}

test('holds a session decision until Chief of Staff releases it', async () => {
	const { id } = await (await request('/items', 'POST', { title: 'Field fixture handoff' })).json();
	const decision = {
		question: 'Which fixture can we use?',
		options: [
			{ label: 'First fixture', effect: 'Use the existing setup.', recommended: true },
			{ label: 'Second fixture', effect: 'Use a fresh setup.' }
		]
	};
	const mark = (verb: string, body: object, actor?: string) =>
		request(`/items/${id}/${verb}`, 'POST', body, actor);
	expect((await mark('flag', decision)).status).toBe(200);
	expect(await (await request(`/items/${id}`)).json()).toMatchObject({
		needs_daniel: false,
		question: null
	});
	expect(await (await request('/items?flagged=1')).json()).toEqual([]);
	expect(await (await request('/digest')).json()).toMatchObject({ to_unblock: [] });
	expect((await mark('release', decision)).status).toBe(403);
	expect((await mark('release', decision, 'Chief of Staff')).status).toBe(200);
	expect(await (await request('/items?flagged=1')).json()).toMatchObject([{ id, ...decision }]);
	expect(await (await request('/digest')).json()).toMatchObject({ to_unblock: [{ id }] });
	expect((await mark('release', decision, 'Chief of Staff')).status).toBe(409);
});

test('holds a Daniel blocker privately and records a Chief of Staff answer', async () => {
	const { id } = await (
		await request('/items', 'POST', { title: 'Fixture access handoff' })
	).json();
	const mark = (verb: string, body: object, actor?: string) =>
		request(`/items/${id}/${verb}`, 'POST', body, actor);
	const reason = 'Waiting on Daniel for fixture access';
	expect((await mark('block', { reason })).status).toBe(200);
	const pending = await (await request(`/items/${id}`)).json();
	expect(JSON.stringify(pending)).not.toContain(reason);
	expect(await (await request('/digest')).json()).toMatchObject({ to_unblock: [] });
	expect((await mark('answer', { answer: 'Use the test account' }, 'auto-worker')).status).toBe(
		403
	);
	expect(
		await (await mark('answer', { answer: 'Use the test account' }, 'Chief of Staff')).json()
	).toMatchObject({ answered_by: 'Chief of Staff', needs_daniel: false, resolved: true });
	expect(await (await request('/items?flagged=1')).json()).toEqual([]);
});
