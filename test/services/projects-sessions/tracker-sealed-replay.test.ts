import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import { sealedRecordHeader } from '../../../packages/remote/src/utils/networking-security/sealedRecord';
import {
	sealedScopeKeys,
	newScopeKeys
} from '../../../packages/remote/src/utils/networking-security/sealedScopeKeys';
import { TrackerSchemaAdapter } from '../../../src/adapters/projects-sessions/TrackerSchemaAdapter';
import { TrackerOperationRepository } from '../../../src/repositories/projects-sessions/TrackerOperationRepository';
import type { TrackerOperation } from '../../../src/repositories/projects-sessions/TrackerOperationRepository.types';
import { TrackerSealedJournal } from '../../../src/services/projects-sessions/tracker-sealed-sync/TrackerSealedJournal';
import { TrackerSealedSyncService } from '../../../src/services/projects-sessions/tracker-sealed-sync/TrackerSealedSyncService';
import type { TrackerSealedNodeOptions } from '../../../src/services/projects-sessions/tracker-sealed-sync/TrackerSealedSyncService.types';
import { replayTrackerSealedJournal } from '../../../src/services/projects-sessions/tracker-sealed-sync/replayTrackerSealedJournal';
import { trackerSealedTicks } from '../../../src/services/projects-sessions/tracker-sealed-sync/trackerSealedTick';
import { canonicalJson } from '../../../src/utils/development-tooling/canonicalJson';

const operation: TrackerOperation = {
	op_id: 'op-1',
	item_id: 'item-1',
	fields: { title: 'tracker canary' },
	hlc: '000000000000010-000000-test',
	node: 'test'
};

function sealedLogFixture(): typeof fetch {
	const records = new Map<string, { opId: string; seq: number; envelope: string }>();
	return (async (url: URL, init: RequestInit) => {
		if (init.method === 'POST') {
			const envelopes = JSON.parse(String(init.body)) as string[];
			const ops = envelopes.map((envelope) => {
				const opId = Buffer.from(
					sealedRecordHeader(Buffer.from(envelope, 'base64url')).objectId
				).toString('base64url');
				const existing = records.get(opId);
				if (existing) return existing;
				const row = { opId, seq: records.size + 1, envelope };
				records.set(opId, row);
				return row;
			});
			return Response.json({ ops, head: records.size });
		}
		const after = Number(url.searchParams.get('after'));
		const ops = [...records.values()].slice(after, after + 1);
		return Response.json({
			ops,
			next: after + ops.length,
			more: after + ops.length < records.size
		});
	}) as typeof fetch;
}

test('hub and spoke backfill their journal and converge through paginated sealed replay', async ({
	onTestFinished
}) => {
	const keys = await sealedScopeKeys(newScopeKeys());
	const request = sealedLogFixture();
	function peer(node: string) {
		const database = new DatabaseSync(':memory:');
		onTestFinished(() => database.close());
		new TrackerSchemaAdapter(database).initialize();
		const store = new TrackerSealedJournal(database, node);
		const journal = new TrackerOperationRepository(database);
		const sync = new TrackerSealedSyncService({
			origin: new URL('https://tracker.example'),
			deviceId: node,
			request,
			currentKeys: keys,
			keysAt: () => keys,
			store
		});
		return { database, journal, sync, store };
	}
	const hub = peer('hub');
	const spoke = peer('spoke');
	hub.journal.applyOps([operation, { ...operation, op_id: 'project-private', item_id: 'private' }]);
	spoke.journal.applyOps([
		{
			...operation,
			op_id: 'op-2',
			hlc: '000000000000020-000000-spoke',
			node: 'spoke',
			fields: { title: 'newer', deleted: 1, 'note+': 'migrated' }
		}
	]);
	const admitted = (entry: TrackerOperation) => entry.item_id === operation.item_id;
	expect(await replayTrackerSealedJournal(hub.journal, hub.sync, 0, admitted)).toBe(2);
	expect(await replayTrackerSealedJournal(spoke.journal, spoke.sync, 0, admitted)).toBe(1);
	expect(await replayTrackerSealedJournal(hub.journal, hub.sync, 0, admitted)).toBe(2);
	await expect(restoreSealedPeer(hub)).resolves.toEqual(await restoreSealedPeer(spoke));

	expect(spoke.database.prepare("SELECT id FROM items WHERE id = 'private'").get()).toBeUndefined();
	await proveWorkerRestart(spoke.database, hub.sync, {
		origin: new URL('https://tracker.example'),
		deviceId: 'spoke',
		request,
		currentKeys: keys,
		keysAt: () => keys,
		logId: 'spoke',
		belongsToScope: admitted
	});
});

async function proveWorkerRestart(
	database: DatabaseSync,
	hubSync: TrackerSealedSyncService,
	scope: TrackerSealedNodeOptions
) {
	const journal = new TrackerOperationRepository(database);
	journal.applyOps([
		{
			...operation,
			op_id: 'spoke-next',
			hlc: '000000000000030-000000-spoke',
			node: 'spoke',
			fields: { status: 'blocked' }
		}
	]);
	const signal = new AbortController().signal;
	await trackerSealedTicks(database, 'spoke', [scope])!.sealedSync(signal);
	await trackerSealedTicks(database, 'spoke', [scope])!.sealedSync(signal);
	await expect(hubSync.pull()).resolves.toBe(false);
	expect(new TrackerSealedJournal(database, 'spoke').cursor()).toBe(3);
}

async function restoreSealedPeer(peer: {
	database: DatabaseSync;
	sync: TrackerSealedSyncService;
	store: TrackerSealedJournal;
}) {
	const { database, sync, store } = peer;
	await expect(sync.pull()).resolves.toBe(true);
	await expect(sync.pull()).resolves.toBe(false);
	expect(store.cursor()).toBe(2);
	expect(
		database.prepare('SELECT title, deleted FROM items WHERE id = ?').get(operation.item_id)
	).toEqual({ title: 'newer', deleted: 1 });
	expect(database.prepare('SELECT text FROM item_notes').all()).toEqual([{ text: 'migrated' }]);
	const rows = new TrackerOperationRepository(database)
		.opsSince(0)
		.filter((entry) => entry.item_id === operation.item_id)
		.map(({ seq: _seq, ...entry }) => entry)
		.sort((left, right) => left.op_id.localeCompare(right.op_id));
	expect(rows.map(({ op_id }) => op_id)).toEqual(['op-1', 'op-2']);
	return {
		count: rows.length,
		sha256: createHash('sha256').update(canonicalJson(rows)).digest('hex')
	};
}
