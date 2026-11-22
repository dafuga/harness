import { expect, test, vi } from 'vitest';
import { TrackerSpokeSyncService } from '../../../src/services/projects-sessions/TrackerSpokeSyncService';
import type { TrackerSpokeOptions } from '../../../src/services/projects-sessions/TrackerSpokeSyncService.types';
import { measureWorkload } from '../../support/measureWorkload';
import { legacyTrackerTransport } from './tracker-spoke-sync/legacyTrackerSyncFixture';
import {
	createSpokeJournal,
	fixtureOperation,
	fixtureSecret
} from './tracker-spoke-sync/trackerSpokeFixture';

const unit = 'service.projects-sessions-tracker-spoke-sync';

function spoke(options: Pick<TrackerSpokeOptions, 'store' | 'transport' | 'link'>) {
	return new TrackerSpokeSyncService({ secret: fixtureSecret, pullWaitSeconds: 0, ...options });
}

test('push retries a lost receipt after restart and drains local operations in bounded batches', async () => {
	await measureWorkload(unit, 'push-retry-after-lost-receipt', async () => {
		const foreign = fixtureOperation('foreign', 'fixture-peer');
		const local = Array.from({ length: 501 }, (_, index) => fixtureOperation(`own-${index}`));
		const store = createSpokeJournal(undefined, [foreign, ...local]);
		const remote = createSpokeJournal('fixture-hub');
		const legacy = legacyTrackerTransport(remote, 'hub-id');
		const lost = vi.fn(async (request: Parameters<typeof legacy>[0]) => {
			await legacy(request);
			throw new Error('fixture lost push receipt');
		});
		await expect(spoke({ store, transport: lost }).push()).rejects.toThrow('lost push receipt');
		expect([store.getMeta('pushed_seq'), store.getMeta('hub_db_id')]).toEqual([null, null]);
		expect(remote.maxSeq()).toBe(500);

		const retry = vi.fn(legacy);
		await expect(spoke({ store, transport: retry }).push()).resolves.toBe(501);
		expect(retry).toHaveBeenCalledTimes(2);
		expect(retry.mock.calls[0][0]).toMatchObject({
			method: 'POST',
			pathAndQuery: '/sync/push',
			timeoutMs: 30_000,
			body: lost.mock.calls[0][0].body,
			headers: { 'x-tracker-node': store.node, 'content-type': 'application/json' }
		});
		expect(remote.entries.map(({ op_id }) => op_id)).toEqual(local.map(({ op_id }) => op_id));
		expect([store.getMeta('pushed_seq'), store.getMeta('hub_db_id')]).toEqual(['502', 'hub-id']);
	});
});

test('push rejects an unsuccessful receipt and replays all retained origins on an identity change', async () => {
	const foreign = fixtureOperation('foreign', 'old-hub');
	const own = fixtureOperation('own');
	const store = createSpokeJournal(undefined, [foreign, own]);
	store.writeMeta({ hub_db_id: 'old-id', pull_cursor: '30', pushed_seq: '1', push_all: '0' });
	const invalid = spoke({
		store,
		transport: async () => ({ ok: false, db_id: 'new-id', last: 123 })
	});
	await expect(invalid.push()).rejects.toThrow('Invalid Tracker push receipt');
	expect(['hub_db_id', 'pull_cursor', 'pushed_seq', 'push_all'].map(store.getMeta)).toEqual([
		'old-id',
		'30',
		'1',
		'0'
	]);

	const remote = createSpokeJournal('fixture-hub');
	const wire = vi.fn(legacyTrackerTransport(remote, 'new-id'));
	await expect(spoke({ store, transport: wire }).push()).resolves.toBe(2);
	expect(wire).toHaveBeenCalledTimes(2);
	expect(remote.entries.map(({ op_id }) => op_id)).toEqual(['own', 'foreign']);
	expect(['hub_db_id', 'pull_cursor', 'pushed_seq', 'push_all'].map(store.getMeta)).toEqual([
		'new-id',
		'0',
		'2',
		'0'
	]);
});

test('pull applies without remote sequence numbers and re-reads after a failed cursor write', async () => {
	await measureWorkload(unit, 'pull-retry-after-cursor-write-failure', async () => {
		const own = fixtureOperation('own');
		const foreign = fixtureOperation('new-op', 'fixture-hub');
		const journal = createSpokeJournal(undefined, [own]);
		journal.writeMeta({ hub_db_id: 'hub-id', pull_cursor: '1' });
		const applyOps = vi.fn(journal.applyOps);
		const writeMeta = vi.fn(journal.writeMeta).mockImplementationOnce(() => {
			throw new Error('fixture cursor write failed');
		});
		const store = { ...journal, applyOps, writeMeta };
		const wire = vi.fn(
			legacyTrackerTransport(createSpokeJournal('fixture-hub', [own, foreign]), 'hub-id')
		);
		await expect(spoke({ store, transport: wire }).pull()).rejects.toThrow('cursor write failed');
		expect(journal.getMeta('pull_cursor')).toBe('1');
		expect(journal.maxSeq()).toBe(2);

		await expect(spoke({ store, transport: wire }).pull()).resolves.toEqual({
			status: 'applied',
			last: 2,
			hub: 'fixture-hub'
		});
		expect(wire.mock.calls.map(([request]) => request.pathAndQuery)).toEqual(
			Array(2).fill('/sync/pull?since=1&wait=0')
		);
		expect(applyOps.mock.calls).toEqual([[[foreign]], [[foreign]]]);
		expect(journal.maxSeq()).toBe(2);
		expect(journal.getMeta('pull_cursor')).toBe('2');
	});
});

test('pull rejects a cursor that skips an operation and honors the legacy empty rewind', async () => {
	const store = createSpokeJournal();
	store.writeMeta({ hub_db_id: 'hub-id', pull_cursor: '7' });
	const remote = createSpokeJournal('fixture-hub', [fixtureOperation('old-op')]);
	const relay = legacyTrackerTransport(remote, 'hub-id');
	const invalid = spoke({
		store,
		transport: async () => ({ ops: [], last: 9, max: 9, db_id: 'hub-id', hub: 'fixture-hub' })
	});
	await expect(invalid.pull()).rejects.toThrow('Invalid Tracker pull page');
	expect(store.getMeta('pull_cursor')).toBe('7');
	await expect(spoke({ store, transport: relay }).pull()).resolves.toMatchObject({ last: 1 });
	expect(store.getMeta('pull_cursor')).toBe('1');
});

test('pull resets only the changed link and a peer relays duplicates without affecting hub cursors', async () => {
	const foreign = fixtureOperation('foreign', 'old-hub');
	const own = fixtureOperation('own');
	const store = createSpokeJournal(undefined, [foreign, own]);
	store.writeMeta({
		hub_db_id: 'old-id',
		pull_cursor: '70',
		pushed_seq: '2',
		push_all: '0',
		peer_hub_db_id: 'peer-id',
		peer_pull_cursor: '9',
		peer_pushed_seq: '0'
	});
	const hub = createSpokeJournal('fixture-hub', [fixtureOperation('new-hub-op', 'fixture-hub')]);
	const peer = createSpokeJournal('fixture-peer', [own]);
	const hubWire = vi.fn(legacyTrackerTransport(hub, 'new-id'));
	const hubClient = spoke({ store, transport: hubWire });
	const peerClient = spoke({
		store,
		transport: legacyTrackerTransport(peer, 'peer-id'),
		link: 'peer'
	});
	await expect(hubClient.pull()).resolves.toEqual({ status: 'reset' });
	expect(store.maxSeq()).toBe(2);
	expect(['hub_db_id', 'pull_cursor', 'pushed_seq', 'push_all'].map(store.getMeta)).toEqual([
		'new-id',
		'0',
		'0',
		'1'
	]);
	expect(
		['peer_hub_db_id', 'peer_pull_cursor', 'peer_pushed_seq', 'peer_push_all'].map(store.getMeta)
	).toEqual(['peer-id', '9', '0', null]);
	await expect(peerClient.push()).resolves.toBe(2);
	expect(peer.entries.map(({ op_id }) => op_id)).toEqual(['own', 'foreign']);
	await expect(hubClient.pull()).resolves.toMatchObject({ last: 1 });
	expect(hubWire.mock.calls.map(([request]) => request.pathAndQuery)).toEqual([
		'/sync/pull?since=70&wait=0',
		'/sync/pull?since=0&wait=0'
	]);
	expect(
		['pushed_seq', 'pull_cursor', 'peer_pushed_seq', 'peer_pull_cursor'].map(store.getMeta)
	).toEqual(['0', '1', '2', '9']);
});

test('a delayed pull from the former database cannot undo a push identity transition', async () => {
	const store = createSpokeJournal(undefined, [fixtureOperation('own')]);
	store.writeMeta({ hub_db_id: 'old-id', pull_cursor: '0', pushed_seq: '0' });
	const oldWire = legacyTrackerTransport(
		createSpokeJournal('old-hub', [fixtureOperation('old-page', 'old-hub')]),
		'old-id'
	);
	const newWire = legacyTrackerTransport(createSpokeJournal('new-hub'), 'new-id');
	let releasePull: () => void = () => {};
	const pending = new Promise<void>((resolve) => {
		releasePull = resolve;
	});
	const transport: TrackerSpokeOptions['transport'] = vi.fn(async (request) => {
		if (request.method === 'POST') return newWire(request);
		const response = await oldWire(request);
		await pending;
		return response;
	});
	const client = spoke({ store, transport });
	const pull = client.pull();
	const alsoPull = client.pull();
	try {
		await expect(Promise.all([client.push(), client.push()])).resolves.toEqual([1, 1]);
	} finally {
		releasePull();
	}
	await expect(Promise.all([pull, alsoPull])).resolves.toEqual([
		{ status: 'stale' },
		{ status: 'stale' }
	]);
	expect(transport).toHaveBeenCalledTimes(3);
	expect(['hub_db_id', 'pull_cursor', 'pushed_seq'].map(store.getMeta)).toEqual([
		'new-id',
		'0',
		'1'
	]);
	expect(store.entries.map(({ op_id }) => op_id)).toEqual(['own']);
});
