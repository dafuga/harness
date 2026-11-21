// @harness-uid u_bl6xl2h4a3
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import type { WatchdogStartupService } from '../WatchdogStartupService';
import type { WatchdogScan } from '../WatchdogPaneService.types';
import { readWatchdogAlerts } from './trackerHostWatchdogState';

export function recordStartupAlerts(
	store: TrackerPersistenceService,
	snapshot: WatchdogScan,
	startup: WatchdogStartupService
): void {
	const previousAlerts = Object.values(readWatchdogAlerts(store))
		.filter(({ kind }) => kind === 'startup')
		.map(({ item_id, reason, identity }) => ({ id: item_id, reason, identity }));
	const plan = startup.plan({ ...snapshot, previousAlerts });
	for (const action of plan.actions) {
		if (action.action !== 'alert' || !action.writeAlert) continue;
		recordWatchdogAlert(
			store,
			{
				itemId: action.id,
				kind: 'startup',
				reason: action.reason,
				identity: action.identity
			},
			snapshot.now,
			action.question
		);
	}
	for (const cleared of plan.clearAlerts) clearStartupAlert(store, cleared);
}

function clearStartupAlert(
	store: TrackerPersistenceService,
	{ id, clearQuestion }: { id: string; clearQuestion: boolean }
): void {
	const alerts = readWatchdogAlerts(store);
	delete alerts[`${id}:startup`];
	const persist = () => store.writeMeta({ watchdog_alerts: JSON.stringify(alerts) });
	if (clearQuestion)
		store.appendLocal({ itemId: id, fields: { needs_daniel: 0, question: null } }, persist);
	else persist();
}

export function recordWatchdogAlert(
	store: TrackerPersistenceService,
	{
		itemId,
		kind,
		reason,
		identity
	}: { itemId: string; kind: string; reason: string; identity: string },
	at: number,
	question: string | null = `${store.node}: ${reason} Chief of Staff, please inspect the session.`
): void {
	const key = `${itemId}:${kind}`;
	const alerts = readWatchdogAlerts(store);
	if (alerts[key]?.identity === identity) return;
	const alert = {
		id: `${store.node}:${key}:${at}`,
		item_id: itemId,
		kind,
		host: store.node,
		reason,
		identity,
		at
	};
	const fields = {
		'note+': `watchdog ${kind}: ${reason}`,
		...(question && {
			needs_daniel: 1,
			resolved: 0,
			question
		})
	};
	store.appendLocal({ itemId, fields }, () =>
		store.writeMeta({ watchdog_alerts: JSON.stringify({ ...alerts, [key]: alert }) })
	);
}
