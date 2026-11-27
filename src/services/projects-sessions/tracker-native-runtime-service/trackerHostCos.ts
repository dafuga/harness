// @harness-uid u_bl6xl2h4a3
import type { TrackerWatchdogPort } from './trackerWatchdogPort.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { urgentQueueAlertKind } from './trackerHostWatchdogAlerts';
import { launchWithoutRunKind } from './trackerWatchLaunchRequests';
import { isOutageAlert } from './trackerCosAlertKinds';
import type { TrackerWatchdogAlert } from './trackerHostWatchdog.types';

const batchSize = 8;

/** Alerts with no delivery receipt yet. */
export function unsentCosAlerts(
	store: TrackerPersistenceService,
	alerts: readonly TrackerWatchdogAlert[]
) {
	const sent = sentIds(store);
	return alerts.filter(({ id }) => !sent.has(id));
}

export async function sendWatchdogAlerts(
	store: TrackerPersistenceService,
	driver: TrackerWatchdogPort,
	alerts: readonly TrackerWatchdogAlert[],
	signal: AbortSignal
): Promise<void> {
	const unsent = unsentCosAlerts(store, alerts).sort(
		(a, b) => alertRank(a.kind) - alertRank(b.kind) || a.at - b.at
	);
	const batch = unsent.slice(0, batchSize);
	if (!batch.length) return;
	if (!(await driver.send(batch, signal, { backlog: unsent.length > batch.length }))) return;
	const sent = sentIds(store);
	for (const { id } of batch) sent.add(id);
	store.writeMeta({ watchdog_cos_sent: JSON.stringify([...sent].slice(-1000)) });
}

function sentIds(store: TrackerPersistenceService) {
	return new Set<string>(JSON.parse(store.getMeta('watchdog_cos_sent') ?? '[]'));
}

function alertRank(kind: string) {
	if (kind === urgentQueueAlertKind) return 0;
	if (isOutageAlert(kind)) return 1;
	return kind === launchWithoutRunKind ? 2 : 3;
}
