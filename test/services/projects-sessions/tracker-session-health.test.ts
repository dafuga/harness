import { DatabaseSync } from 'node:sqlite';
import { test, vi } from 'vitest';
import { expect } from '../../verificationExpect';
import type { TrackerItem } from '../../../src/repositories/projects-sessions/TrackerItemReadRepository.types';
import { TrackerItemReadRepository } from '../../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';
import {
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
		const items = new TrackerItemReadRepository(store.database);
		const item = items.getStored(itemId);
		const orphan = observedPane('auto-noitem');
		const issues = readTrackerSessionHealth(store, items.list(), [orphan], now);
		expect(issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ item_id: itemId, kind: 'missing', recover: true }),
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
			fields: { question: 'Blocked: Cannot proceed without Daniel approving the release.' }
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
		status: 'ignored'
	});
	expect(launch).toHaveBeenCalledOnce();
}
