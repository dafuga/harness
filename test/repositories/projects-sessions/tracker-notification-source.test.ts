import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import { TrackerItemReadRepository } from '../../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerNotificationSourceRepository } from '../../../src/repositories/projects-sessions/TrackerNotificationSourceRepository';
import { TrackerLocalApiService } from '../../../src/services/projects-sessions/TrackerLocalApiService';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';
import {
	notificationFixture,
	start,
	wire,
	worker
} from '../../services/projects-sessions/tracker-notification/fixture';

test('delivers a committed item completion once through the shared Tracker journal source', async () => {
	const database = new DatabaseSync(':memory:');
	try {
		const store = new TrackerPersistenceService(database, 'fixture-owner', { now: () => start });
		const api = new TrackerLocalApiService(store, new TrackerItemReadRepository(database), {
			now: () => start
		});
		const reference = 'https://fixture.invalid/complete';
		const journalSource = new TrackerNotificationSourceRepository(store, {
			timeZone: 'Europe/Lisbon',
			resolveDestination: (target) =>
				target && typeof target === 'object' && 'url' in target && target.url === reference
					? worker
					: undefined
		});
		const fixture = notificationFixture({ options: { role: 'spoke', source: journalSource } });
		const create = await post(api, '/items', { title: 'Fixture task', callback_url: reference });
		expect(create.status).toBe(201);
		const { id } = await create.json();
		await fixture.service.tick();
		expect(fixture.calls).toHaveLength(0);
		const complete = await post(api, `/items/${id}/done`, { note: 'Fixture completion note' });
		expect(complete.status).toBe(200);
		await Promise.all([fixture.service.tick(), fixture.restart().tick()]);
		expect(fixture.calls).toHaveLength(1);
		expect(fixture.calls[0].destination).toEqual(worker);
		expect(wire(fixture.calls[0])).toMatchObject({
			events: ['done'],
			node: 'fixture-owner',
			item: { id, status: 'done', notes_log: [{ text: 'Fixture completion note' }] }
		});
		expect(JSON.stringify(fixture.calls[0])).not.toContain(reference);
		expect(store.maxSeq()).toBe(2);
	} finally {
		database.close();
	}
});

function post(api: TrackerLocalApiService, path: string, payload: object) {
	return api.handle(
		new Request(`http://fixture.invalid${path}`, { method: 'POST', body: JSON.stringify(payload) })
	);
}
