import { expect, vi } from 'vitest';
import { compatibilityFixture, fixtureItem, fixtureTime } from './trackerCliCompatibilityFixture';
import type { TrackerMessageCandidate } from '../../src/services/projects-sessions/TrackerAdapterPollService.types';
import { readWatchdogAlerts } from '../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostWatchdogState';

const activation = Date.parse(fixtureTime) - 1_000;
const title = 'A configured message matched';
const selector = [
	'--from',
	'exact@sender.example',
	'--domain',
	'trusted.example',
	'--thread',
	'known-thread',
	'--keyword',
	'fixture phrase'
];

export async function verifyTrackerMessageIntake() {
	try {
		await verifyMessageIntake();
	} finally {
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
	}
}

async function verifyMessageIntake() {
	const read = vi.fn(async function* () {
		yield* matchingFixture();
	});
	const fixture = await compatibilityFixture(true, {
		manual: true,
		lease: { owner: 'daniel-primary-mbp', tryAcquire: () => () => {} },
		provider: {
			async *readIssues() {},
			async readTimeline() {
				return [];
			}
		},
		messageProviders: { gmail: read },
		redactText: (text) => text
	});
	fixture.runtime.store.appendLocal({
		itemId: fixtureItem,
		fields: { auto: null, due: null, schedule_off: 1 }
	});
	await verifyNotification(fixture);
	await verifyTask(fixture);
	await verifyDispatch(fixture);
	expect(read).toHaveBeenCalled();
}

async function verifyNotification({
	run,
	runtime,
	database
}: Awaited<ReturnType<typeof compatibilityFixture>>) {
	const { store } = runtime;
	const rule = [
		'adapter',
		'add',
		'gmail',
		'--target',
		'notify-reply',
		'--title',
		title,
		...selector,
		'--notify',
		fixtureItem.slice(0, 6),
		'--after',
		new Date(activation).toISOString()
	];
	const seq = store.maxSeq();
	expect(await run(...rule, '--dry-run')).toMatchObject({
		code: 0,
		out: expect.stringContaining('would notify')
	});
	expect(store.maxSeq()).toBe(seq);
	expect(await run(...rule)).toMatchObject({ code: 0 });
	database.exec(`CREATE TRIGGER reject_message_receipt BEFORE INSERT ON adapter_links
		BEGIN SELECT RAISE(ABORT, 'synthetic receipt failure'); END;`);
	const id = 'gmail:notify-reply';
	expect(await run('adapter', 'run', id)).toMatchObject({
		code: 1,
		err: 'tracker: Tracker adapter intake failed'
	});
	expect(store.maxSeq()).toBe(seq);
	expect(readWatchdogAlerts(store)).toEqual({});
	database.exec('DROP TRIGGER reject_message_receipt');
	expect(await run('adapter', 'run', id)).toMatchObject({ code: 0 });
	expect(store.maxSeq()).toBe(seq + 4);
	expect(await run('adapter', 'run', id)).toMatchObject({
		code: 0,
		out: 'No items to create or link.'
	});
	expect(store.maxSeq()).toBe(seq + 4);
	verifyAlertReceipts(store, seq);
}

function verifyAlertReceipts(
	store: Awaited<ReturnType<typeof compatibilityFixture>>['runtime']['store'],
	seq: number
) {
	expect(
		Object.values(readWatchdogAlerts(store)).map(({ kind, item_id, reason }) => ({
			kind,
			item_id,
			reason
		}))
	).toEqual(
		Array.from({ length: 4 }, () => ({ kind: 'alert', item_id: fixtureItem, reason: title }))
	);
	expect(JSON.stringify(store.opsSince(seq, 10))).not.toMatch(
		/sender\.example|trusted\.example|known-thread|fixture phrase/
	);
}

async function verifyTask({ run, database }: Awaited<ReturnType<typeof compatibilityFixture>>) {
	const id = 'gmail:create-task';
	const add = [
		'adapter',
		'add',
		'gmail',
		'--target',
		'create-task',
		'--title',
		title,
		'--keyword',
		'fixture phrase',
		'--agent',
		'harness',
		'--auto-launch',
		'match',
		'--after',
		new Date(activation).toISOString()
	];
	expect(await run(...add, '--quiet-hours', '12:00-12:01')).toMatchObject({ code: 0 });
	expect(await run('adapter', 'run', id)).toMatchObject({
		code: 0,
		out: expect.stringContaining('deferred')
	});
	expect(await run('adapter', 'remove', id)).toMatchObject({ code: 0 });
	expect(await run(...add)).toMatchObject({ code: 0 });
	expect(await run('adapter', 'run', id)).toMatchObject({
		code: 0,
		out: expect.stringContaining('due for auto-launch')
	});
	expect(
		database.prepare('SELECT agent, due, title FROM items WHERE title = ?').all(title)
	).toEqual([{ agent: 'harness', due: fixtureTime, title }]);
	expect(await run('adapter', 'run', id)).toMatchObject({
		code: 0,
		out: 'No items to create or link.'
	});
}

async function verifyDispatch({
	runtime,
	runner,
	database
}: Awaited<ReturnType<typeof compatibilityFixture>>) {
	const row = database.prepare('SELECT id FROM items WHERE title = ?').get(title);
	runner.start.mockImplementation(async ({ run, key }) => ({
		type: 'session',
		session: { key, id: 'synthetic-gmail-task', startedAt: run.queued_at, state: 'live' }
	}));
	const signal = new AbortController().signal;
	expect(runtime.scheduler).toBeDefined();
	await runtime.scheduler!.tick(signal);
	expect(runner.start).toHaveBeenCalledOnce();
	expect(runner.start.mock.calls[0]?.[0]).toMatchObject({ run: { item_id: row?.id } });
}

function matchingFixture(): TrackerMessageCandidate[] {
	const base = {
		id: 'provider-private-id',
		sender: 'unmatched@example.test',
		threadId: 'unmatched',
		receivedAt: activation,
		keywordMatched: false
	};
	const thread = { ...base, threadId: 'known-thread' };
	return [
		thread,
		thread,
		{ ...base, id: 'sender', sender: 'Exact@sender.example' },
		{ ...base, id: 'domain', sender: 'fixture@trusted.example' },
		{ ...base, id: 'keyword', keywordMatched: true },
		{ ...base, id: 'spoof', sender: 'fixture@trusted.example.evil' },
		{ ...thread, id: 'before-activation', receivedAt: activation - 1 }
	];
}
