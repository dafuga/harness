import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { TrackerItemReadRepository } from '../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerPersistenceService } from '../../src/services/projects-sessions/TrackerPersistenceService';
import { watchCosDelivery } from '../../src/services/projects-sessions/tracker-native-runtime-service/trackerCosDelivery';
import type { TrackerWatchdogAlert } from '../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostWatchdog.types';

export const minute = 60_000;
export const hour = 60 * minute;
/** Noon in Lisbon, inside the 08:00 to 22:00 send window. */
export const noon = Date.UTC(2026, 10, 26, 12);

export function alert(kind: string, at: number): TrackerWatchdogAlert {
	return {
		id: `fixture:worker0001:${kind}:${at}`,
		item_id: 'worker0001',
		host: 'fixture-hub',
		kind,
		reason: `Synthetic ${kind} alert.`,
		identity: `${kind}:${at}`,
		at
	};
}

export async function cosDeliveryFixture(
	prove: (ports: {
		store: TrackerPersistenceService;
		items: TrackerItemReadRepository;
	}) => void | Promise<void>,
	node = 'fixture-hub'
) {
	const database = new DatabaseSync(':memory:');
	const store = new TrackerPersistenceService(database, node, { now: () => noon });
	const items = new TrackerItemReadRepository(database);
	try {
		await prove({ store, items });
	} finally {
		database.close();
	}
}

export function round(
	store: TrackerPersistenceService,
	pending: readonly TrackerWatchdogAlert[],
	now: number
) {
	watchCosDelivery(store, pending, now);
}

/** The open decisions Daniel's apps list under "needs you". */
export function alarmAsks(items: TrackerItemReadRepository, now: number) {
	return items.digest(now).daniel_decisions;
}

/** A pane driver that fails every request, as a host with no working tmux would. */
export function brokenDriver(root: string) {
	const executable = join(root, 'broken-driver');
	writeFileSync(executable, `#!${process.execPath}\nprocess.exit(1);\n`, { mode: 0o700 });
	return executable;
}
