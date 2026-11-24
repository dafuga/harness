import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { TrackerItemReadRepository } from '../../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerLocalApiService } from '../../../src/services/projects-sessions/TrackerLocalApiService';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';

let database: DatabaseSync;
let store: TrackerPersistenceService;
let api: TrackerLocalApiService;

beforeEach(() => {
	const now = () => Date.UTC(2026, 10, 21, 12);
	database = new DatabaseSync(':memory:');
	store = new TrackerPersistenceService(database, 'fixture-mac', { now });
	api = new TrackerLocalApiService(store, new TrackerItemReadRepository(database), { now });
});

afterEach(() => database.close());

function request(path: string, method = 'GET', payload?: object) {
	return api.handle(
		new Request(`http://127.0.0.1:7700${path}`, {
			method,
			headers: { 'x-tracker-as': 'fixture-actor' },
			body: JSON.stringify(payload)
		})
	);
}

test('commits inbox notes and reviewed decisions without accepting a replaced question', async () => {
	const { id } = await (await request('/items', 'POST', { title: 'Mac fixture decision' })).json();
	const inbox = `/items/${id}/inbox`;
	const read = async () => {
		const response = await request(inbox);
		expect(response.status).toBe(200);
		return response.json();
	};
	const write = (action: string, text: string, revision: unknown = null, path = inbox) =>
		request(path, 'POST', { action, text, revision });
	const initial = await read();
	expect(initial).toMatchObject({
		item: { id, needs_daniel: false },
		revision: expect.any(String)
	});
	expect((await write('note', 'Reviewed on Mac')).status).toBe(200);
	expect((await read()).revision).toBe(initial.revision);
	expect((await write('flag', 'First question?', initial.revision)).status).toBe(200);
	const first = await read();
	expect(first.item).toMatchObject({ question: 'First question?', needs_daniel: true });
	expect(first.revision).not.toBe(initial.revision);
	expect(
		(await request(`/items/${id}/flag`, 'POST', { question: 'Replacement question?' })).status
	).toBe(200);
	const before = store.maxSeq();
	const stale = await write('answer', 'Old answer', first.revision);
	expect(stale.status).toBe(409);
	expect(await stale.json()).toMatchObject({ code: 'staleReview' });
	expect((await write('flag', 'Overwrite?', initial.revision)).status).toBe(409);
	expect((await write('note', 'Wrong target', null, `/items/${id.slice(0, 6)}/inbox`)).status).toBe(
		404
	);
	expect(store.maxSeq()).toBe(before);
	const current = await read();
	expect(current.item).toMatchObject({ question: 'Replacement question?', resolved: false });
	expect((await write('answer', 'Reviewed answer', current.revision)).status).toBe(200);
	expect((await read()).item).toMatchObject({
		needs_daniel: false,
		resolved: true,
		answer: 'Reviewed answer',
		notes_log: [{ text: 'Reviewed on Mac' }]
	});
});
