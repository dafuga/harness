import { DatabaseSync } from 'node:sqlite';
import { test, vi } from 'vitest';
import { expect } from '../../verificationExpect';
import type { TrackerItem } from '../../../src/repositories/projects-sessions/TrackerItemReadRepository.types';
import { TrackerItemReadRepository } from '../../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerDispatchRepository } from '../../../src/repositories/projects-sessions/TrackerDispatchRepository';
import { TrackerDispatcherService } from '../../../src/services/agents-providers/TrackerDispatcherService';
import { fixturePolicy } from '../../support/trackerDispatcherFixture';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';
import {
	applyTrackerSessionHealth,
	trackerRecoveryLaunch,
	readTrackerSessionHealth,
	recheckTrackerRecovery
} from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerSessionHealthRuntime';
import type { WatchdogPane } from '../../../src/services/projects-sessions/WatchdogPaneService.types';
import { measureWorkload } from '../../support/measureWorkload';

const host = 'harbor-mbp-2';
const itemId = 'abc123def4';
const queued = 'queued1234';
const now = 1_800_000_000_000;
const signal = new AbortController().signal;

test('holds recovery for a late live pane and reports a stranded launch and an orphan', () =>
	measureWorkload(
		'service.projects-sessions-tracker-native-runtime',
		'watchdog-recovery-guard',
		proveRecovery
	));

async function proveRecovery() {
	const database = new DatabaseSync(':memory:');
	try {
		const store = new TrackerPersistenceService(database, host, { now: () => now - 720_000 });
		seedRecoveryItems(store);
		const items = new TrackerItemReadRepository(store.database);
		const item = items.getStored(itemId);
		const orphan = observedPane('auto-noitem');
		const issues = readTrackerSessionHealth(store, items.list(), [orphan], now);
		expect(issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					item_id: itemId,
					kind: 'missing',
					recover: false,
					reason: expect.stringContaining('automatic launch opted out')
				}),
				expect.objectContaining({
					item_id: queued,
					kind: 'launch-stuck',
					reason: expect.stringContaining('without a run')
				}),
				expect.objectContaining({ item_id: 'noitem', kind: 'orphan', session: 'auto-noitem' })
			])
		);
		await verifyRecoveryRecheck(store, item);
		store.appendLocal({
			itemId,
			fields: {
				needs_daniel: 1,
				question: 'Blocked: Cannot proceed without Daniel approving the release.'
			}
		});
		expect(readTrackerSessionHealth(store, items.list(), [], now)).toContainEqual(
			expect.objectContaining({ item_id: itemId, kind: 'missing', recover: false })
		);
	} finally {
		database.close();
	}
}

function observedPane(name: string): WatchdogPane {
	return {
		name,
		key: name,
		createdAt: now - 600_000,
		activity: now,
		live: true,
		attached: false,
		ready: true,
		readable: false,
		runnerSocket: true,
		x: 0,
		y: 0,
		screen: null
	};
}

async function verifyRecoveryRecheck(store: TrackerPersistenceService, item: TrackerItem) {
	const launch = vi.fn(async () => ({ status: 'ignored' as const, reason: 'fixture' }));
	const driver = {
		scan: vi.fn(async () => [observedPane('auto-abc123-r87')]),
		nudge: vi.fn(async () => false),
		send: vi.fn(async () => false)
	};
	const request = { store, driver, signal };
	expect(await recheckTrackerRecovery(request, item, launch, now)).toMatchObject({
		status: 'held'
	});
	expect(launch).not.toHaveBeenCalled();
	driver.scan.mockResolvedValue([]);
	expect(await recheckTrackerRecovery(request, item, launch, now)).toMatchObject({
		status: 'held'
	});
	expect(launch).not.toHaveBeenCalled();
	store.appendLocal({ itemId: item.id, fields: { schedule_off: 0, needs_daniel: 0 } });
	expect(await recheckTrackerRecovery(request, item, launch, now)).toMatchObject({
		status: 'ignored'
	});
	expect(launch).toHaveBeenCalledOnce();
}

function seedRecoveryItems(store: TrackerPersistenceService) {
	store.appendLocal({
		itemId,
		fields: {
			title: 'Recoverable item',
			status: 'in_progress',
			kind: 'task',
			computer: host,
			notes: 'A short brief',
			schedule_off: true,
			needs_daniel: 1,
			question: 'Please review the proposed wording when you have time.'
		}
	});
	store.appendLocal({
		itemId: queued,
		fields: {
			title: 'Stranded intent',
			status: 'open',
			kind: 'task',
			computer: host,
			auto: 'fixture-intent'
		}
	});
}

test.each([
	{ outcome: 'timed_out', reason: 'old ETA timeout', state: 'open' },
	{ outcome: 'abandoned', reason: 'managed session disappeared', state: 'open' },
	{ outcome: 'blocked', reason: 'waiting on a credential', state: 'blocked' }
])(
	'reconciles old $outcome receipts only after their local or peer sessions disappear',
	async ({ outcome, reason, state }) => {
		const db = new DatabaseSync(':memory:');
		try {
			const store = new TrackerPersistenceService(db, host, { now: () => now - 720_000 });
			const repository = new TrackerDispatchRepository(store);
			const policy = fixturePolicy(() => now, { node: host });
			const launch = trackerRecoveryLaunch(new TrackerDispatcherService(repository, policy));
			const items = new TrackerItemReadRepository(db);
			store.appendLocal({
				itemId,
				fields: {
					title: 'Resume existing work',
					status: 'in_progress',
					computer: host,
					auto: 'old-token'
				}
			});
			seedEndedReceipt(db, { outcome, reason });
			const tick = (panes: readonly WatchdogPane[] = []) => {
				const rows = items.list();
				return applyTrackerSessionHealth(
					store,
					readTrackerSessionHealth(store, rows, panes, now),
					{ now, items: rows, launch },
					signal
				);
			};
			await tick([observedPane('auto-abc123-r1')]);
			expect(items.getStored(itemId).status).toBe('in_progress');
			db.prepare(
				"INSERT INTO remote_runs (node,id,item_id,state) VALUES ('daniel-primary-mbp',1,?,'running')"
			).run(itemId);
			await tick();
			expect(items.getStored(itemId).status).toBe('in_progress');
			db.prepare('DELETE FROM remote_runs WHERE item_id = ?').run(itemId);
			await Promise.all([tick(), tick()]);
			await tick();
			expect(items.getStored(itemId).status).toBe(state);
			const runs = db.prepare("SELECT id FROM runs WHERE state = 'queued'").all();
			expect(runs).toEqual(state === 'open' ? [{ id: 2 }] : []);
			if (state === 'blocked') expect(items.getStored(itemId).blocked_reason).toBe(reason);
		} finally {
			db.close();
		}
	}
);

function seedEndedReceipt(
	db: DatabaseSync,
	{ outcome, reason }: { outcome: string; reason: string }
) {
	db.prepare(
		`INSERT INTO runs (item_id, auto_token, rung, cli, model, state, outcome, failure_reason, queued_at, started_at, ended_at)
		VALUES (?, 'old-token', 'sol', 'codex', 'gpt-6.2-sol', 'finished', ?, ?, ?, ?, ?)`
	).run(itemId, outcome, reason, now - 700_000, now - 690_000, now - 60_000);
}
