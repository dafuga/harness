import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import { TrackerSyncAuthService } from '../../../src/services/networking-security/TrackerSyncAuthService';
import type { TrackerHubSyncService } from '../../../src/services/projects-sessions/TrackerHubSyncService';
import type { TrackerLocalApiService } from '../../../src/services/projects-sessions/TrackerLocalApiService';
import { TrackerNativeRuntimeService } from '../../../src/services/projects-sessions/TrackerNativeRuntimeService';
import type { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';
import { TrackerSpokeSyncService } from '../../../src/services/projects-sessions/TrackerSpokeSyncService';
import type { TrackerSpokeTransport } from '../../../src/services/projects-sessions/TrackerSpokeSyncService.types';

const fixtureSecret = 'synthetic-tracker-wire-secret';

function nativeStore(node: string, role: 'hub' | 'spoke' = 'spoke') {
	const database = new DatabaseSync(':memory:');
	const {
		items: api,
		store,
		sync
	} = new TrackerNativeRuntimeService(database, {
		node,
		role,
		now: () => 5000,
		storage: { databaseId: () => `fixture-${node}` },
		syncResponder: role === 'hub' ? { auth: new TrackerSyncAuthService(fixtureSecret) } : undefined
	});
	return { api, database, store, sync };
}

function wire(hub: TrackerHubSyncService): TrackerSpokeTransport {
	return async (request) => {
		const data = new Request('http://tracker-fixture.invalid' + request.pathAndQuery, {
			method: request.method,
			headers: request.headers,
			body: request.body
		});
		const response = await hub.handle({
			method: request.method,
			pathAndQuery: request.pathAndQuery,
			headers: data.headers,
			body: data.body
		});
		if (!response.ok) throw new Error(`Fixture sync failed with status ${response.status}`);
		return await response.json();
	};
}

function spoke(store: TrackerPersistenceService, transport: TrackerSpokeTransport) {
	return new TrackerSpokeSyncService({
		store,
		transport,
		secret: fixtureSecret,
		pullWaitSeconds: 0
	});
}

function local(api: TrackerLocalApiService, path: string, method = 'GET', body?: object) {
	return api.handle(
		new Request('http://tracker-fixture.invalid' + path, {
			method,
			body: JSON.stringify(body)
		})
	);
}

test('native hub and two native spokes converge after a lost receipt and offline edits', async () => {
	const alpha = nativeStore('alpha');
	const beta = nativeStore('beta');
	const central = nativeStore('hub', 'hub');
	try {
		if (!central.sync) throw new Error('Fixture hub sync responder is required');
		const transport = wire(central.sync);
		let drop = true;
		const alphaLink = spoke(alpha.store, async (request) => {
			const reply = await transport(request);
			if (request.pathAndQuery === '/sync/push' && drop) {
				drop = false;
				throw new Error('fixture lost push receipt');
			}
			return reply;
		});
		const betaLink = spoke(beta.store, transport);
		const created = await local(alpha.api, '/items', 'POST', { title: 'Fixture task' });
		expect(created.status).toBe(201);
		const { id } = await created.json();
		const path = '/items/' + id;
		await expect(alphaLink.push()).rejects.toThrow('fixture lost push receipt');
		expect(central.store.maxSeq()).toBe(1);
		expect(alpha.store.countLocalOpsSince(Number(alpha.store.getMeta('pushed_seq')))).toBe(1);
		await alphaLink.push();
		expect(central.store.maxSeq()).toBe(1);
		await betaLink.pull();

		const [alphaEdit, betaEdit] = await Promise.all([
			local(alpha.api, path + '/note', 'POST', { text: 'Alpha note' }),
			local(beta.api, path, 'PATCH', { owner: 'fixture-owner', append_note: 'Beta note' })
		]);
		expect([alphaEdit.status, betaEdit.status]).toEqual([200, 200]);
		await Promise.all([alphaLink.push(), betaLink.push()]);
		await Promise.all([alphaLink.pull(), betaLink.pull()]);
		for (const { api, store } of [alpha, beta, central]) {
			expect(store.maxSeq()).toBe(3);
			expect(await (await local(api, path)).json()).toMatchObject({
				title: 'Fixture task',
				owner: 'fixture-owner',
				status: 'open',
				notes_log: [
					{ node: 'alpha', text: 'Alpha note' },
					{ node: 'beta', text: 'Beta note' }
				]
			});
		}
	} finally {
		alpha.database.close();
		beta.database.close();
		central.database.close();
	}
});
