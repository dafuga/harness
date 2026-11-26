// @harness-uid u_bl6xl2h4a3
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import type { WatchdogPane } from '../WatchdogPaneService.types';
import type { TrackerWatchdogAlert } from './trackerHostWatchdog.types';
import { recordWatchdogAlert } from './trackerHostWatchdogAlerts';
import { readWatchdogAlerts } from './trackerHostWatchdogState';
import { readTrackerSlotState, slotAlertKinds } from './trackerSlotInvariants';
import { trackerSlotSummary } from './trackerSlotSummary';

const summaryKey = 'watchdog_slot_summary';

/** Replace this computer's slot alerts with what is true now. Cleared breaches drop out. */
export function publishTrackerSlotAlerts(
	store: TrackerPersistenceService,
	panes: readonly WatchdogPane[],
	slots: { now: number; cap: number | null }
): void {
	const { report, violations } = readTrackerSlotState(store, panes, slots);
	const active = new Map(
		violations.map((issue) => [`${issue.item_id}:${issue.kind}:${issue.session}`, issue])
	);
	const kept = Object.entries(readWatchdogAlerts(store)).filter(
		([key, { kind }]) => !slotAlertKinds.has(kind) || active.has(key)
	);
	store.writeMeta({
		watchdog_alerts: JSON.stringify(Object.fromEntries(kept)),
		[summaryKey]: trackerSlotSummary(report)
	});
	for (const [key, issue] of active)
		recordWatchdogAlert(
			store,
			{ ...issue, itemId: issue.item_id, key, localOnly: true },
			slots.now
		);
}

/** The summary is added on read, so its changing ages never resend an alert. */
export function withSlotSummary(
	store: TrackerPersistenceService,
	alert: TrackerWatchdogAlert
): TrackerWatchdogAlert {
	if (!slotAlertKinds.has(alert.kind)) return alert;
	return { ...alert, slots: store.getMeta(summaryKey) ?? undefined };
}
