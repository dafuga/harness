import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import { TrackerSyncAuthService } from '../../../src/services/networking-security/TrackerSyncAuthService';
import { TrackerHubSyncService } from '../../../src/services/projects-sessions/TrackerHubSyncService';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';
import { TrackerSpokeSyncService } from '../../../src/services/projects-sessions/TrackerSpokeSyncService';
import type { TrackerSpokeTransport } from '../../../src/services/projects-sessions/TrackerSpokeSyncService.types';
import { planTrackerItemMutation } from '../../../src/utils/projects-sessions/planTrackerItemMutation';

const item = { id: 'fixture-item', title: 'Fixture task', status: 'open' };
const fixtureSecret = 'synthetic-tracker-wire-secret';

function nativeStore(node: string) {
	const database = new DatabaseSync(':memory:');
	const store = new TrackerPersistenceService(database, node, {
		now: () => 5000,
		databaseId: () => `fixture-${node}`
	});
	return { database, store };
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

function editWhileDisconnected(alpha: TrackerPersistenceService, beta: TrackerPersistenceService) {
	alpha.appendLocal(
		planTrackerItemMutation(
			{ action: 'note', item, body: { text: 'Alpha note' } },
			{ node: alpha.node, now: 5000, candidates: [] }
		)
	);
	beta.appendLocal(
		planTrackerItemMutation(
			{ action: 'update', item, body: { owner: 'fixture-owner', append_note: 'Beta note' } },
			{ node: beta.node, now: 5000, candidates: [] }
		)
	);
}

test('native hub and two native spokes converge after a lost receipt and offline edits', async () => {
	const alpha = nativeStore('alpha');
	const beta = nativeStore('beta');
	const central = nativeStore('hub');
	try {
		const transport = wire(
			new TrackerHubSyncService({
				auth: new TrackerSyncAuthService(fixtureSecret),
				store: central.store
			})
		);
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
		alpha.store.appendLocal(
			planTrackerItemMutation(
				{ action: 'add', itemId: item.id, body: { title: item.title } },
				{ node: alpha.store.node, now: 5000, candidates: [] }
			)
		);
		await expect(alphaLink.push()).rejects.toThrow('fixture lost push receipt');
		expect(central.store.maxSeq()).toBe(1);
		expect(alpha.store.countLocalOpsSince(Number(alpha.store.getMeta('pushed_seq')))).toBe(1);
		await alphaLink.push();
		expect(central.store.maxSeq()).toBe(1);
		await betaLink.pull();

		editWhileDisconnected(alpha.store, beta.store);
		await Promise.all([alphaLink.push(), betaLink.push()]);
		await Promise.all([alphaLink.pull(), betaLink.pull()]);
		for (const { database, store } of [alpha, beta, central]) {
			expect(store.maxSeq()).toBe(3);
			expect(database.prepare('SELECT title, owner, status FROM items').get()).toEqual({
				title: 'Fixture task',
				owner: 'fixture-owner',
				status: 'open'
			});
			expect(database.prepare('SELECT node, text FROM item_notes ORDER BY hlc').all()).toEqual([
				{ node: 'alpha', text: 'Alpha note' },
				{ node: 'beta', text: 'Beta note' }
			]);
		}
	} finally {
		alpha.database.close();
		beta.database.close();
		central.database.close();
	}
});
