import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyTrackerSealedMigration } from '../../../src/services/projects-sessions/tracker-sealed-sync/verifyTrackerSealedMigration';

import { DatabaseSync } from 'node:sqlite';
import { TrackerSchemaAdapter } from '../../../src/adapters/projects-sessions/TrackerSchemaAdapter';
import { TrackerSealedJournal } from '../../../src/services/projects-sessions/tracker-sealed-sync/TrackerSealedJournal';
import { expect, test } from 'vitest';
import { TrackerSealedSyncService } from '../../../src/services/projects-sessions/tracker-sealed-sync/TrackerSealedSyncService';
import type { TrackerOperation } from '../../../src/repositories/projects-sessions/TrackerOperationRepository.types';
import {
	sealedScopeKeys,
	newScopeKeys
} from '../../../packages/remote/src/utils/networking-security/sealedScopeKeys';

const operation: TrackerOperation = {
	op_id: 'op-1',
	item_id: 'item-1',
	fields: { title: 'tracker canary' },
	hlc: '000000000000010-000000-test',
	node: 'test'
};

test('Tracker resumes a lost upload receipt and stops its cursor on an unauthenticated page', async ({
	onTestFinished
}) => {
	const keys = await sealedScopeKeys(newScopeKeys());
	const database = new DatabaseSync(':memory:');
	onTestFinished(() => database.close());
	new TrackerSchemaAdapter(database).initialize();
	const journal = new TrackerSealedJournal(database, 'fixture-log');
	let envelope = '';
	let corrupt = true;
	const service = new TrackerSealedSyncService({
		origin: new URL('https://tracker.example'),
		deviceId: 'fixture-device',
		currentKeys: keys,
		keysAt: () => keys,
		store: journal,
		request: (async (url: URL, init: RequestInit) => {
			expect(url.pathname).toBe(
				'/api/sync/v1/ops/' + Buffer.from(keys.scopeId).toString('base64url')
			);
			if (init.method === 'POST') {
				const [posted] = JSON.parse(String(init.body)) as string[];
				expect(init.body).not.toContain(operation.item_id);
				if (!envelope) {
					envelope = posted;
					return new Response(null, { status: 503 });
				}
				expect(posted).toBe(envelope);
			}
			const bytes = Buffer.from(envelope, 'base64url');
			const opId = bytes.subarray(21, 53).toString('base64url');
			if (init.method === 'POST') return Response.json({ ops: [{ opId, seq: 1 }], head: 1 });
			if (corrupt) bytes[bytes.length - 1] ^= 1;
			return Response.json({
				ops: [{ seq: 1, opId, envelope: bytes.toString('base64url') }],
				next: 1,
				more: false
			});
		}) as typeof fetch
	});
	await service.stage(1, operation);
	await expect(service.push()).rejects.toThrow('503');
	await expect(service.push()).resolves.toBe(1);
	await expect(service.pull()).rejects.toThrow('authentication');
	expect(journal.cursor()).toBe(0);
	expect(database.prepare('SELECT title FROM items').all()).toEqual([]);
	corrupt = false;
	await expect(service.pull()).resolves.toBe(false);
	expect(journal.cursor()).toBe(1);
	expect(database.prepare('SELECT title FROM items').all()).toEqual([{ title: 'tracker canary' }]);
	await service.stage(1, operation);
	await expect(service.push()).resolves.toBe(0);
});

test('backup count and hash proof allows new sealed state and detects a changed legacy row', ({
	onTestFinished
}) => {
	const directory = mkdtempSync(join(tmpdir(), 'tracker-sealed-proof-'));
	onTestFinished(() => rmSync(directory, { recursive: true, force: true }));
	const database = new DatabaseSync(':memory:');
	onTestFinished(() => database.close());
	new TrackerSchemaAdapter(database).initialize();
	database.exec("INSERT INTO items (id, title) VALUES ('fixture', 'before')");
	const before = join(directory, 'before.sqlite');
	const after = join(directory, 'after.sqlite');
	const changed = join(directory, 'changed.sqlite');
	database.prepare('VACUUM INTO ?').run(before);
	new TrackerSealedJournal(database, 'fixture-log');
	database.prepare('VACUUM INTO ?').run(after);
	expect(verifyTrackerSealedMigration(before, after, { node: 'fixture' })).toMatchObject({
		matches: true,
		changedTables: []
	});
	database.exec("UPDATE items SET title = 'changed'");
	database.prepare('VACUUM INTO ?').run(changed);
	const proof = verifyTrackerSealedMigration(before, changed, { node: 'fixture' });
	expect(proof.matches).toBe(false);
	expect(proof.changedTables).toEqual(['items']);
	expect(proof.before.tables.find(({ name }) => name === 'items')?.rowCount).toBe(1);
	expect(proof.after.tables.find(({ name }) => name === 'items')?.rowCount).toBe(1);
});
