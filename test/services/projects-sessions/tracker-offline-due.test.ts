import { createServer, type RequestListener } from 'node:http';
import type { AddressInfo } from 'node:net';
import { DatabaseSync } from 'node:sqlite';
import { test, vi } from 'vitest';
import { expect } from '../../verificationExpect';
import { TrackerNativeRuntimeService } from '../../../src/services/projects-sessions/TrackerNativeRuntimeService';
import type { TrackerDispatchRunner } from '../../../src/services/projects-sessions/TrackerDispatchSchedulerService.types';
import { trackerUpstreamLink } from '../../../src/services/projects-sessions/tracker-node-service/trackerUpstreamLink';
import { fixturePolicy, primary, secondary } from '../../support/trackerDispatcherFixture';
import { fixtureSecret } from '../../support/trackerDispatchQueueFixture';

const signal = new AbortController().signal;
const noon = Date.parse('2026-11-25T12:00:00Z');
const now = () => noon;

async function listener(handler: RequestListener) {
	const server = createServer(handler);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	const close = () =>
		new Promise<void>((resolve) => {
			server.closeAllConnections();
			server.close(() => resolve());
		});
	return { url, close };
}

async function refusedHub() {
	const hub = await listener(() => {});
	await hub.close();
	return { url: hub.url, close: async () => {} };
}

const answering = (status: number, body: string) =>
	listener((_request, response) => response.writeHead(status).end(body));

function spoke(hubUrl: string, cachedPolicy?: object) {
	const database = new DatabaseSync(':memory:');
	const start = vi.fn<TrackerDispatchRunner['start']>(async ({ run, key }) => ({
		type: 'session',
		session: { key, id: run.item_id, state: 'live', startedAt: noon }
	}));
	const runtime = new TrackerNativeRuntimeService(database, {
		node: secondary,
		role: 'spoke',
		now,
		links: [trackerUpstreamLink({ url: hubUrl }, fixtureSecret, 'hub', false)],
		dispatch: {
			policy: fixturePolicy(now, { node: secondary }),
			scheduleDue: true,
			due: () => ({ enabled: true, paused: false, localDue: true }),
			runner: { start, observe: async () => undefined }
		}
	});
	if (cachedPolicy) runtime.store.writeMeta({ due_scheduler_policy: JSON.stringify(cachedPolicy) });
	const add = (id: string, fields: object = {}) =>
		runtime.store.appendLocal({
			itemId: id,
			fields: {
				title: id,
				kind: 'task',
				status: 'open',
				project: 'harness',
				computer: secondary,
				created_by: secondary,
				due: '2026-11-24T09:00:00.000Z',
				...fields
			}
		});
	const started = () => start.mock.calls.map(([{ run }]) => run.item_id);
	return { database, runtime, add, started };
}

const outages: [string, () => Promise<{ url: string; close(): Promise<void> }>][] = [
	['refuses the connection', refusedHub],
	['drops the connection', () => listener((request) => request.socket.destroy())],
	['never answers', () => listener(() => {})],
	['sits behind a gateway returning 502', () => answering(502, 'bad gateway')],
	['sits behind a gateway returning 503', () => answering(503, 'unavailable')],
	['sits behind a tunnel returning 530', () => answering(530, 'tunnel error')]
];

for (const [name, open] of outages) {
	test(`a spoke starts its own due task when the hub ${name}`, async () => {
		const hub = await open();
		const peer = spoke(hub.url);
		try {
			peer.add('offline001');
			await peer.runtime.scheduler!.tick(signal);
			expect(peer.started()).toEqual(['offline001']);
		} finally {
			peer.database.close();
			await hub.close();
		}
	}, 15_000);
}

const refusals: [string, number, string][] = [
	['denies the permit', 200, '{"allowed":false}'],
	['rejects the signature', 401, '{"error":"unauthorized"}'],
	['fails internally', 500, '{"error":"internal server error"}'],
	['returns an unreadable reply', 200, 'not json'],
	['returns a malformed permit', 200, '{"allowed":"yes"}']
];

for (const [name, status, body] of refusals) {
	test(`a spoke holds its due task when the hub ${name}`, async () => {
		const hub = await answering(status, body);
		const peer = spoke(hub.url);
		try {
			peer.add('held000001');
			await peer.runtime.scheduler!.tick(signal);
			expect(peer.started()).toEqual([]);
		} finally {
			peer.database.close();
			await hub.close();
		}
	});
}

const cached: [string, object][] = [
	['paused due launches', { paused: true, local_due: true, at: noon - 1 }],
	['turned local due off', { paused: false, local_due: false, at: noon - 1 }]
];

for (const [name, policy] of cached) {
	test(`an unreachable hub that had ${name} still holds the spoke`, async () => {
		const hub = await refusedHub();
		const peer = spoke(hub.url, policy);
		try {
			peer.add('cached0001');
			await peer.runtime.scheduler!.tick(signal);
			expect(peer.started()).toEqual([]);
		} finally {
			peer.database.close();
		}
	});
}

test('tasks another computer owns take no offline launch slot', async () => {
	const hub = await refusedHub();
	const peer = spoke(hub.url);
	try {
		for (const id of ['other00001', 'other00002', 'other00003'])
			peer.add(id, { computer: 'auto', created_by: primary, launch_target: secondary });
		for (const id of ['other00001', 'other00002', 'other00003'])
			peer.runtime.store.appendLocal({
				itemId: id,
				fields: { auto: `token-${id}`, launch_source: 'due', priority: 'urgent' }
			});
		peer.add('mine000001');
		await peer.runtime.scheduler!.tick(signal);
		await peer.runtime.scheduler!.tick(signal);
		expect(peer.started()).toEqual(['mine000001']);
	} finally {
		peer.database.close();
	}
});

test('a held automatic launch does not stall due work while the hub is down', async () => {
	const hub = await refusedHub();
	const peer = spoke(hub.url);
	try {
		peer.add('recover001', {
			auto: 'recovery-token',
			launch_source: 'recovery',
			launch_target: secondary,
			priority: 'urgent',
			due: null
		});
		peer.add('due0000001');
		await peer.runtime.scheduler!.tick(signal);
		expect(peer.started()).toEqual(['due0000001']);
	} finally {
		peer.database.close();
	}
});

test('offline due launches stay within two starts a minute', async () => {
	const hub = await refusedHub();
	const peer = spoke(hub.url);
	try {
		for (const id of ['rate000001', 'rate000002', 'rate000003']) peer.add(id);
		for (let tick = 0; tick < 4; tick++) await peer.runtime.scheduler!.tick(signal);
		expect(peer.started()).toHaveLength(2);
	} finally {
		peer.database.close();
	}
});
