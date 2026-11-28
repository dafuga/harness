import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import { TrackerNativeRuntimeService } from '../../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { withTempDir } from '../../support/temporary';
import { measureWorkload } from '../../support/measureWorkload';
import { verifyNeverAutoLaunch } from '../../support/trackerDueLaunchFixture';

test('the primary hub delivers reminders through its CoS host binding without a webhook', () =>
	withTempDir('hnt-reminder-', proveHostReminders));

async function proveHostReminders(root: string) {
	const executable = join(root, 'watchdog');
	const receipts = join(root, 'receipts.ndjson');
	writeFileSync(executable, `#!${process.execPath}\n${driver}`, { mode: 0o700 });
	const db = new DatabaseSync(':memory:');
	let now = Date.parse('2026-11-24T02:00:00Z');
	const wake = now + 60_000;
	const create = () => hostReminderRuntime(db, executable, () => now);
	try {
		const runtime = create();
		runtime.store.appendLocal({
			itemId: 'fixture123',
			fields: {
				title: 'Synthetic reminder',
				kind: 'task',
				status: 'open',
				remind_at: new Date(wake).toISOString()
			}
		});
		await verifyNeverAutoLaunch(runtime, 'fixture123', 'set');
		await runtime.notifications?.tick();
		expect(existsSync(receipts)).toBe(false);
		now = wake;
		await measureWorkload(
			'service.projects-sessions-tracker-native-runtime',
			'scheduled-host-reminder',
			() => runtime.notifications?.tick()
		);
		await create().notifications?.tick();
		expect(receivedReceipts(receipts)).toMatchObject([
			{
				operation: 'watchdog-cos',
				alerts: [{ item_id: 'fixture123', kind: 'remind_at', at: wake }]
			}
		]);
		await verifyAskFollowThrough(
			runtime,
			create,
			{
				now: () => now,
				at: (at) => {
					now = at;
				}
			},
			receipts
		);
		now = Date.parse('2026-11-25T07:58:00Z');
		await verifyFirstClassReminder(create(), receipts, (time) => {
			now = time;
		});
	} finally {
		db.close();
	}
}

async function verifyAskFollowThrough(
	runtime: TrackerNativeRuntimeService,
	restart: () => TrackerNativeRuntimeService,
	{ now, at }: { now: () => number; at: (time: number) => void },
	receipts: string
) {
	runtime.store.appendLocal({
		itemId: 'decision01',
		fields: {
			title: 'Synthetic ask',
			kind: 'task',
			status: 'open',
			needs_daniel: 1,
			question: 'Proceed?'
		}
	});
	await verifyNeverAutoLaunch(runtime, 'decision01', 'set');
	const asked = now();
	await runtime.notifications?.tick();
	at(asked + 120 * 60_000);
	await restart().notifications?.tick();
	const alerts = receivedReceipts(receipts).flatMap(({ alerts }) => alerts);
	expect(alerts.filter(({ item_id }) => item_id === 'decision01')).toMatchObject([
		{
			item_id: 'decision01',
			kind: 'needs-daniel',
			reason: expect.stringContaining('for 0 minutes')
		},
		{
			item_id: 'decision01',
			kind: 'needs-daniel',
			reason: expect.stringContaining('for 120 minutes')
		}
	]);
	const answer = new Request('http://tracker-fixture.invalid/items/decision01/answer', {
		method: 'POST',
		body: JSON.stringify({ answer: 'Proceed' })
	});
	expect((await runtime.items.handle(answer))?.ok).toBe(true);
	at(asked + 360 * 60_000);
	await restart().notifications?.tick();
	expect(receivedReceipts(receipts)).toHaveLength(3);
}

function receivedReceipts(path: string) {
	return readFileSync(path, 'utf8')
		.trim()
		.split('\n')
		.map((line) => JSON.parse(line));
}

const driver = `
const { appendFileSync, readFileSync } = require('node:fs');
const { dirname, join } = require('node:path');
const alerts = JSON.parse(readFileSync(0, 'utf8')).alerts;
const operation = process.argv[2];
appendFileSync(join(dirname(process.argv[1]), 'receipts.ndjson'), JSON.stringify({ operation, alerts }) + '\\n');
process.stdout.write(JSON.stringify({ sent: true }));
`;

async function verifyFirstClassReminder(
	runtime: TrackerNativeRuntimeService,
	receipts: string,
	clock: (at: number) => void
) {
	const at = runtime.now() + 2 * 60_000;
	const response = await runtime.items.handle(
		new Request('http://tracker-fixture.invalid/items', {
			method: 'POST',
			body: JSON.stringify({
				title: 'New reminder item',
				kind: 'reminder',
				remind_at: new Date(at).toISOString()
			})
		})
	);
	const reminder = await response.json();
	expect(reminder).toMatchObject({ kind: 'reminder', auto: null, schedule_off: true });
	await runtime.notifications?.tick();
	clock(at - 1);
	await runtime.notifications?.tick();
	expect(receivedReceipts(receipts)).toHaveLength(3);
	clock(at);
	await runtime.notifications?.tick();
	expect(receivedReceipts(receipts).at(-1)).toMatchObject({
		operation: 'watchdog-cos',
		alerts: [{ item_id: reminder.id, kind: 'remind_at', at }]
	});
	expect(
		runtime.store.database.prepare('SELECT id FROM runs WHERE item_id = ?').all(reminder.id)
	).toEqual([]);
}

function hostReminderRuntime(db: DatabaseSync, executable: string, now: () => number) {
	return new TrackerNativeRuntimeService(db, {
		node: 'daniel-primary-mbp',
		role: 'hub',
		now,
		manualLaunch: true,
		hostEffects: { watchdog: { driver: executable, chiefOfStaff: true } }
	});
}
