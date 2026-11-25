// @harness-uid u_bl6xl2h4a3
import type { TrackerWatchdogPort } from './trackerWatchdogPort.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { urgentQueueAlertKind } from './trackerHostWatchdogAlerts';
import { launchWithoutRunKind } from './trackerWatchLaunchRequests';
import type { TrackerWatchdogAlert } from './trackerHostWatchdog.types';

export async function sendWatchdogAlerts(
	store: TrackerPersistenceService,
	driver: TrackerWatchdogPort,
	alerts: readonly TrackerWatchdogAlert[],
	signal: AbortSignal
): Promise<void> {
	const sent = new Set<string>(JSON.parse(store.getMeta('watchdog_cos_sent') ?? '[]'));
	const batch = alerts
		.filter(({ id }) => !sent.has(id))
		.sort((a, b) => alertRank(a.kind) - alertRank(b.kind) || a.at - b.at)
		.slice(0, 8);
	if (!batch.length) return;
	if (!(await driver.send(batch, signal))) return;
	for (const { id } of batch) sent.add(id);
	store.writeMeta({ watchdog_cos_sent: JSON.stringify([...sent].slice(-1000)) });
}

function alertRank(kind: string) {
	if (kind === urgentQueueAlertKind) return 0;
	return kind === launchWithoutRunKind ? 1 : 2;
}
