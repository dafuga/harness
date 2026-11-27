import { DatabaseSync } from 'node:sqlite';
import { expect, test, vi } from 'vitest';
import { TrackerSyncAuthService } from '../../../src/services/networking-security/TrackerSyncAuthService';
import type { TrackerLocalApiService } from '../../../src/services/projects-sessions/TrackerLocalApiService';
import { TrackerNativeRuntimeService } from '../../../src/services/projects-sessions/TrackerNativeRuntimeService';
import type { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';
import { TrackerSpokeSyncService } from '../../../src/services/projects-sessions/TrackerSpokeSyncService';
import type { TrackerSpokeTransport } from '../../../src/services/projects-sessions/TrackerSpokeSyncService.types';

import { primary, secondary } from '../../support/trackerDispatcherFixture';
import type { TrackerDispatchRunner } from '../../../src/services/projects-sessions/TrackerDispatchSchedulerService.types';

import {
	configuredIntakePair,
	fixtureSecret,
	wire
} from '../../support/trackerDispatchQueueFixture';

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
		await proveAdapterDelegation();
	} finally {
		alpha.database.close();
		beta.database.close();
		central.database.close();
	}
});

async function proveAdapterDelegation() {
	const hubDb = new DatabaseSync(':memory:');
	const peerDb = new DatabaseSync(':memory:');
	const now = () => Date.parse('2026-11-25T08:05:00Z');
	const started = vi.fn<TrackerDispatchRunner['start']>(async ({ run, key }) => ({
		type: 'session',
		session: { id: run.item_id, key, state: 'live', startedAt: now() }
	}));
	const hubStart = vi.fn<TrackerDispatchRunner['start']>();
	const { hub, peer, transport } = configuredIntakePair(
		{ hubDb, peerDb, now },
		{ hubStart, started }
	);
	const signal = new AbortController().signal;
	const id = 'tester1234';
	try {
		await peer.scheduler!.tick(signal);
		await peer.telemetry!(signal);
		hub.store.appendLocal({
			itemId: id,
			fields: {
				title: 'Tester follow-up',
				project: 'BuildFlexity',
				kind: 'task',
				status: 'open',
				adapter_due_owner: primary,
				computer: primary,
				created_by: primary,
				due: new Date(now()).toISOString()
			}
		});
		await hub.scheduler!.tick(signal);
		const path = '/items/' + id;
		const item = await (await local(hub.items, path)).json();
		expect(item).toMatchObject({ launch_source: 'due', launch_target: secondary });
		expect(hubStart).not.toHaveBeenCalled();
		const link = spoke(peer.store, transport);
		expect(await link.permitDue(id, 'wrong-token')).toBe(false);
		await link.pull();
		await peer.scheduler!.tick(signal);
		expect(started).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({
				run: expect.objectContaining({ item_id: id, node: secondary, model: 'gpt-6.2-sol' })
			}),
			expect.any(AbortSignal),
			expect.any(String)
		);
		await hub.scheduler!.tick(signal);
		expect(hubStart).not.toHaveBeenCalled();
	} finally {
		hubDb.close();
		peerDb.close();
	}
}

test('two fleet sessions acquire intersecting paths through one hub before editing', async () => {
	const hub = nativeStore('hub', 'hub');
	const first = 'alpha00001';
	const second = 'beta000002';
	try {
		for (const id of [first, second]) {
			hub.store.appendLocal({ itemId: id, fields: { title: id, status: 'open', auto: id } });
		}
		const claim = async (node: string, id: string, areas: string[]) => {
			const request = {
				method: 'POST' as const,
				pathAndQuery: '/sync/area-claim',
				body: JSON.stringify({ id, token: id, repo: 'fixture/project', areas })
			};
			return wire(hub.sync!)({
				...request,
				timeoutMs: 1000,
				headers: {
					authorization: new TrackerSyncAuthService(fixtureSecret).authorizationHeader(request),
					'x-tracker-node': node
				}
			}) as Promise<{ allowed: boolean; reason: string }>;
		};
		const grants = await Promise.all([
			claim('alpha', first, ['src/launcher']),
			claim('beta', second, ['src/launcher/start.ts'])
		]);
		expect(grants.map(({ allowed }) => allowed).sort()).toEqual([false, true]);
		const aWon = grants[0].allowed;
		const [winner, loser] = aWon ? [first, second] : [second, first];
		expect(grants[aWon ? 1 : 0].reason).toContain(winner);
		expect(
			await claim(aWon ? 'alpha' : 'beta', winner, [
				aWon ? 'src/launcher' : 'src/launcher/start.ts'
			])
		).toMatchObject({ allowed: true });
		expect(await claim('unrelated-host', winner, ['src/launcher'])).toMatchObject({
			allowed: false
		});
		expect(
			(await (await local(hub.api, '/items/' + winner)).json()).notes_log.at(-1).text
		).toContain('src/launcher');
		expect(
			(
				await local(hub.api, '/items/' + winner + '/block', 'POST', {
					reason: 'fixture dependency'
				})
			).status
		).toBe(200);
		expect(await claim(aWon ? 'beta' : 'alpha', loser, ['src/launcher'])).toMatchObject({
			allowed: true
		});
	} finally {
		hub.database.close();
	}
});
