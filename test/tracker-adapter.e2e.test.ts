import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { withTempDir } from './support/temporary';
import { verifyTrackerMessageIntake } from './support/trackerMessageIntakeFixture';
import {
	adapterFixture,
	adapterIssue,
	adapterSourceId,
	sourceRun,
	sqliteFixtureLease
} from './support/trackerAdapterFixture';
test('poll holds the shared lease across a delayed read and releases it on cancellation', async () => {
	await withTempDir('harness-adapter-lease-', async (directory) => {
		const lease = sqliteFixtureLease(join(directory, 'owner.lock'));
		const file = join(directory, 'tracker.db');
		const first = adapterFixture({ lease, database: new DatabaseSync(file) });
		const second = adapterFixture({ lease, database: new DatabaseSync(file) });
		const entered = Promise.withResolvers<void>();
		const resume = Promise.withResolvers<void>();
		const controller = new AbortController();
		first.readIssues.mockImplementationOnce(async function* () {
			entered.resolve();
			await resume.promise;
			yield adapterIssue();
		});
		const polling = first.service.poll(adapterSourceId, { signal: controller.signal });
		try {
			const outcome = await Promise.race([entered.promise.then(() => 'entered'), polling]);
			expect(outcome).toBe('entered');
			await expect(second.service.poll(adapterSourceId)).resolves.toEqual({ status: 'lease-busy' });
			expect(second.readIssues).not.toHaveBeenCalled();
			controller.abort();
			resume.resolve();
			await expect(polling).rejects.toThrow('Tracker adapter poll cancelled');
			expect(first.store.maxSeq()).toBe(0);
			expect(sourceRun(first.database)).toMatchObject({
				cursor: 10_000,
				last_run: null
			});
			await expect(second.service.poll(adapterSourceId)).resolves.toMatchObject({
				status: 'polled'
			});
			expect(second.store.maxSeq()).toBe(1);
		} finally {
			resume.resolve();
			await polling.catch(() => {});
			first.database.close();
			second.database.close();
		}
	});
});
test('poll retries a partially consumed feed and acknowledges the write only after pickup', async () => {
	await withTempDir('harness-adapter-restart-', async (directory) => {
		const file = join(directory, 'tracker.db');
		const lease = sqliteFixtureLease(join(directory, 'owner.lock'));
		const initial = adapterFixture({ database: new DatabaseSync(file), lease });
		try {
			initial.feed.failRead = true;
			await expect(initial.service.poll(adapterSourceId)).rejects.toThrow(
				'Tracker adapter intake failed'
			);
			expect(initial.store.maxSeq()).toBe(1);
			expect(sourceRun(initial.database)).toMatchObject({
				cursor: 10_000,
				last_run: 30_000,
				last_error: 'Tracker adapter intake failed'
			});
			expect(initial.markTracked).not.toHaveBeenCalled();
		} finally {
			initial.database.close();
		}
		const restarted = adapterFixture({ database: new DatabaseSync(file), lease });
		try {
			await verifyWriteRetry(restarted);
		} finally {
			restarted.database.close();
		}
	});
});
test('poll commits links and event receipts with their operations and preserves close and reopen', async () => {
	const fixture = adapterFixture();
	const { database, feed, service, store, items } = fixture;
	try {
		refuseInsert(database, 'adapter_links');
		await expect(service.poll(adapterSourceId)).rejects.toThrow('Tracker adapter intake failed');
		expect(store.maxSeq()).toBe(0);
		expect(database.prepare('SELECT * FROM items').all()).toEqual([]);
		database.exec('DROP TRIGGER refuse_receipt');
		await expect(service.poll(adapterSourceId)).resolves.toMatchObject({
			actions: [{ action: 'create', auto_launch: true }]
		});
		expect(store.opsSince(0, 10)).toMatchObject([
			{ actor: adapterSourceId, fields: { status: 'open', due: new Date(30_000).toISOString() } }
		]);
		const closed = new Date(33_000).toISOString();
		feed.issues = [adapterIssue({ state: 'closed', updated_at: closed })];
		feed.timeline = [
			{ id: 501, event: 'closed', created_at: closed, actor: { login: 'fixture-human' } }
		];
		feed.now = 40_000;
		refuseInsert(database, 'adapter_events');
		await expect(service.poll(adapterSourceId)).rejects.toThrow('Tracker adapter intake failed');
		expect(store.maxSeq()).toBe(1);
		expect(database.prepare('SELECT * FROM item_notes').all()).toEqual([]);
		expect(database.prepare('SELECT remote_state FROM adapter_links').get()).toEqual({
			remote_state: 'open'
		});
		expect(sourceRun(database)).toMatchObject({
			cursor: 30_000
		});
		database.exec('DROP TRIGGER refuse_receipt');
		await expect(service.poll(adapterSourceId)).resolves.toMatchObject({ events: 1 });
		expect(database.prepare('SELECT status, due FROM items').get()).toEqual({
			status: 'done',
			due: null
		});
		const overview = await items.handle(new Request('http://fixture.invalid/items?status=all'));
		expect(await overview.json()).toMatchObject([{ id: 'fixture-001', status: 'done', due: null }]);
		await verifyReopen(fixture);
	} finally {
		database.close();
	}
});
test('poll adopts a matching item without reopening it or creating a second pickup', async () => {
	const { database, feed, service, store, markTracked } = adapterFixture();
	try {
		store.appendLocal({
			itemId: 'manual-item',
			fields: { title: 'example/widgets #17: manual', status: 'done' }
		});
		feed.started = true;
		await expect(service.poll(adapterSourceId)).resolves.toMatchObject({
			actions: [{ action: 'link', item_id: 'manual-item', auto_launch: false }],
			events: 0,
			synced_back: 1
		});
		expect(database.prepare('SELECT id, status FROM items').all()).toEqual([
			{ id: 'manual-item', status: 'done' }
		]);
		expect(store.opsSince(1, 10)).toMatchObject([
			{
				actor: adapterSourceId,
				fields: { 'note+': 'Linked external item: https://github.com/example/widgets/issues/17' }
			}
		]);
		expect(markTracked).toHaveBeenCalledOnce();
	} finally {
		database.close();
	}
});

test('native Gmail rules preview, defer, notify and create once', verifyTrackerMessageIntake);
async function verifyWriteRetry(restarted: ReturnType<typeof adapterFixture>): Promise<void> {
	await expect(restarted.service.poll(adapterSourceId)).resolves.toMatchObject({
		actions: [],
		synced_back: 0
	});
	expect(restarted.readIssues.mock.calls[0]?.[1].since).toBe(5_000);
	expect(restarted.markTracked).not.toHaveBeenCalled();
	restarted.feed.started = true;
	restarted.feed.failWrite = true;
	restarted.feed.now = 40_000;
	await expect(restarted.service.poll(adapterSourceId)).resolves.toMatchObject({
		synced_back: 0,
		sync_errors: [{ external_id: '100', error: 'Tracker adapter write-back failed' }]
	});
	expect(sourceRun(restarted.database)).toMatchObject({
		cursor: 40_000,
		last_error: 'Tracker adapter write-back failed'
	});
	expect(restarted.database.prepare('SELECT sync_pending FROM adapter_links').get()).toEqual({
		sync_pending: 1
	});
	restarted.feed.failWrite = false;
	restarted.feed.now = 35_000;
	await expect(restarted.service.poll(adapterSourceId)).resolves.toMatchObject({
		synced_back: 1,
		sync_errors: []
	});
	await expect(restarted.service.poll(adapterSourceId)).resolves.toMatchObject({
		synced_back: 0
	});
	expect(restarted.markTracked).toHaveBeenCalledTimes(2);
	expect(sourceRun(restarted.database)).toMatchObject({
		cursor: 40_000,
		last_error: null
	});
	expect(restarted.store.maxSeq()).toBe(1);
}

async function verifyReopen(fixture: ReturnType<typeof adapterFixture>): Promise<void> {
	const { database, feed, service, store } = fixture;
	feed.timeline.push({ id: 502, event: 'reopened', created_at: new Date(42_000).toISOString() });
	feed.now = 50_000;
	await expect(service.poll(adapterSourceId)).resolves.toMatchObject({ events: 1 });
	await expect(service.poll(adapterSourceId)).resolves.toMatchObject({ events: 0 });
	expect(database.prepare('SELECT status, due FROM items').get()).toEqual({
		status: 'open',
		due: null
	});
	expect(database.prepare('SELECT event_id FROM adapter_events ORDER BY event_id').all()).toEqual([
		{ event_id: 'state:501' },
		{ event_id: 'state:502' }
	]);
	expect(database.prepare('SELECT text FROM item_notes ORDER BY hlc').all()).toEqual([
		{
			text: 'GitHub issue closed by @fixture-human: https://github.com/example/widgets/issues/17'
		},
		{ text: 'GitHub issue reopened: https://github.com/example/widgets/issues/17' }
	]);
	expect(store.maxSeq()).toBe(3);
}

function refuseInsert(database: DatabaseSync, table: 'adapter_links' | 'adapter_events'): void {
	database.exec(`CREATE TRIGGER refuse_receipt BEFORE INSERT ON ${table}
		BEGIN SELECT RAISE(ABORT, 'fixture receipt refused'); END`);
}
