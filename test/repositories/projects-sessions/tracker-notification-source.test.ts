import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import type { TrackerLocalApiService } from '../../../src/services/projects-sessions/TrackerLocalApiService';
import { TrackerNativeRuntimeService } from '../../../src/services/projects-sessions/TrackerNativeRuntimeService';
import {
	notificationFixture,
	start,
	wire,
	worker
} from '../../services/projects-sessions/tracker-notification/fixture';

test('delivers a committed item completion once through the shared Tracker journal source', async () => {
	const database = new DatabaseSync(':memory:');
	try {
		const reference = 'https://fixture.invalid/complete';
		const fixture = notificationFixture();
		const {
			items: api,
			notifications,
			store
		} = new TrackerNativeRuntimeService(database, {
			node: 'fixture-owner',
			role: 'spoke',
			now: () => start,
			timeZone: 'Europe/Lisbon',
			notification: {
				queue: fixture.queue,
				destinations: fixture.options.destinations,
				resolveDestination: (target) =>
					target && typeof target === 'object' && 'url' in target && target.url === reference
						? worker
						: undefined
			}
		});
		if (!notifications) throw new Error('Fixture notification service is required');
		const create = await post(api, '/items', { title: 'Fixture task', callback_url: reference });
		expect(create.status).toBe(201);
		const { id } = await create.json();
		await notifications.tick();
		expect(fixture.calls).toHaveLength(0);
		const complete = await post(api, `/items/${id}/done`, { note: 'Fixture completion note' });
		expect(complete.status).toBe(200);
		await Promise.all([notifications.tick(), notifications.tick()]);
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
