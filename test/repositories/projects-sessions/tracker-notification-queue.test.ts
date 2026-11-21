import type { DatabaseSync } from 'node:sqlite';
import { test } from 'vitest';
import { measureWorkload } from '../../support/measureWorkload';
import { expect } from '../../verificationExpect';
import {
	chief,
	eventId,
	start,
	wire,
	worker
} from '../../services/projects-sessions/tracker-notification/fixture';
import {
	callbackKey,
	doneKey,
	legacySnapshot,
	legacyTables,
	putAttention,
	putCallback,
	putMetadata,
	putOutbox,
	putReminders,
	reference,
	summaryKey,
	withFixtureFiles
} from './tracker-notification-queue/legacyFixture';
import {
	fixtureRuntime,
	putCompletedItem,
	syntheticReceipt
} from './tracker-notification-queue/runtimeFixture';

const unit = 'repository.projects-sessions-tracker-notification-queue';

test('startup preserves pinned notification rows, pause state and cursors through a legacy reopen', async () => {
	await measureWorkload(unit, 'startup', () =>
		withFixtureFiles(async (files) => {
			const db = files.open();
			db.exec(legacyTables);
			putMetadata(db);
			putCallback(db, start + 1000);
			putOutbox(db, doneKey, start + 1000);
			putReminders(db);
			putAttention(db);
			const before = legacySnapshot(db);

			const runtime = fixtureRuntime(db, { batch: true });
			putCompletedItem(db);
			expect(legacySnapshot(db)).toEqual(before);
			await runtime.service.tick();
			expect(runtime.calls).toEqual([]);
			files.close(db);
			expect(legacySnapshot(files.open())).toEqual(before);
		})
	);
});

test('tick keeps legacy retry eligibility and IDs and resume settles the existing CoS batch', async () => {
	await measureWorkload(unit, 'retry-and-resume', () =>
		withFixtureFiles(async (files) => {
			let now = start;
			const db = files.open();
			db.exec(legacyTables);
			putMetadata(db);
			putOutbox(db, doneKey, start + 1000);
			putOutbox(db, summaryKey, start + 1000);
			putAttention(db);
			const runtime = fixtureRuntime(db, { batch: true, now: () => now });
			putCompletedItem(db);
			putCallback(db, start + 1000);
			await runtime.service.tick();
			expect(runtime.calls).toHaveLength(0);

			now += 1000;
			await runtime.service.tick();
			expect(runtime.calls.map(({ id, destination }) => [id, destination])).toEqual([
				[callbackKey, worker],
				[eventId(doneKey), worker]
			]);
			expect(wire(runtime.calls[1])).toMatchObject({
				attempt: 4,
				items: [{ event_id: eventId(doneKey) }]
			});
			await runtime.service.resume();
			expect(runtime.calls.map(({ id, destination }) => [id, destination])).toEqual([
				[callbackKey, worker],
				[eventId(doneKey), worker],
				[eventId(doneKey), chief]
			]);
			expect(wire(runtime.calls[2])).toMatchObject({ catch_up: true, batch: true });
			files.close(db);
			assertLegacyResume(files.open(), now);
		})
	);
});

test('tick replays the exact committed request after a receipt and a rolled-back acknowledgement', async () => {
	await measureWorkload(unit, 'receipt-replay', () =>
		withFixtureFiles(async (files) => {
			const db = files.open();
			const receiver = files.open('receiver.sqlite');
			const original = fixtureRuntime(db, { send: syntheticReceipt(receiver) });
			putCompletedItem(db);
			db.exec(`CREATE TRIGGER reject_ack BEFORE UPDATE OF status ON deliveries
				WHEN NEW.status = 'ok' BEGIN SELECT RAISE(ABORT, 'synthetic acknowledgement failure'); END;`);
			await expect(original.service.tick()).rejects.toThrow('synthetic acknowledgement failure');
			expect(original.calls).toHaveLength(1);
			expect(db.prepare('SELECT key, status, attempts FROM deliveries').all()).toEqual([
				{ key: callbackKey, status: 'pending', attempts: 0 }
			]);
			db.exec(
				"DROP TRIGGER reject_ack; UPDATE items SET title = 'Changed after receipt', callback = NULL"
			);
			files.close(db);
			files.close(receiver);

			const reopened = files.open();
			const receiptStore = files.open('receiver.sqlite');
			const input = { now: () => start + 1000, send: syntheticReceipt(receiptStore) };
			const restart = fixtureRuntime(reopened, input);
			const competing = fixtureRuntime(files.open(), input);
			await Promise.all([restart.service.tick(), competing.service.tick()]);
			expect([...restart.calls, ...competing.calls]).toEqual(original.calls);
			expect(JSON.stringify(restart.calls[0])).not.toContain(reference);
			expect(receiptStore.prepare('SELECT count(*) AS count FROM receipts').get()).toEqual({
				count: 1
			});
			expect(reopened.prepare('SELECT key, status, attempts FROM deliveries').all()).toEqual([
				{ key: callbackKey, status: 'ok', attempts: 1 }
			]);
			await fixtureRuntime(files.open(), input).service.tick();
			expect(receiptStore.prepare('SELECT count(*) AS count FROM receipts').get()).toEqual({
				count: 1
			});
		})
	);
});

test('startup refuses incompatible notification tables and rolls back the queue schema migration', async () => {
	await measureWorkload(unit, 'migration-rollback', () =>
		withFixtureFiles((files) => {
			const db = files.open();
			db.exec(
				"CREATE TABLE webhook_flags (key TEXT PRIMARY KEY); INSERT INTO webhook_flags VALUES ('sentinel');"
			);
			expect(() => fixtureRuntime(db)).toThrow(/webhook_flags/);
			expect(db.prepare('SELECT * FROM webhook_flags').all()).toEqual([{ key: 'sentinel' }]);
			expect(
				db
					.prepare(
						"SELECT name FROM sqlite_schema WHERE name IN ('cos_queue', 'cos_state', 'webhook_outbox')"
					)
					.all()
			).toEqual([]);
		})
	);
});

function assertLegacyResume(legacy: DatabaseSync, now: number): void {
	expect(legacy.prepare('SELECT status, attempts, done_at FROM deliveries').get()).toEqual({
		status: 'ok',
		attempts: 3,
		done_at: now
	});
	expect(
		legacy
			.prepare('SELECT status, attempts, sent_at FROM webhook_outbox WHERE key = ?')
			.get(doneKey)
	).toEqual({ status: 'sent', attempts: 4, sent_at: now });
	expect(legacy.prepare('SELECT status, sent_at, batch_id FROM cos_queue').get()).toEqual({
		status: 'sent',
		sent_at: now,
		batch_id: eventId(doneKey)
	});
	expect(
		legacy.prepare("SELECT k, v FROM meta WHERE k IN ('webhook_paused', 'cos_force')").all()
	).toEqual([]);
	expect(legacy.prepare("SELECT v FROM meta WHERE k = 'webhook_seq'").get()).toEqual({
		v: '17'
	});
}
