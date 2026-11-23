// @harness-uid u_bl6xl2h4a3
import { createHash } from 'node:crypto';
import type { IdleDecision } from '../WatchdogIdleService.types';
import type { WatchdogPane, WatchdogScan } from '../WatchdogPaneService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { recordWatchdogAlert } from './trackerHostWatchdogAlerts';
import { sessionHealthInterval } from './trackerSessionHealth';
import type { TrackerWatchdogPort } from './trackerWatchdogPort.types';

const nudge =
	'Continue the current task. Flag only true blockers on the Tracker item and keep working on everything else.';

export async function applyIdleDecision(
	{
		store,
		driver,
		snapshot
	}: {
		store: TrackerPersistenceService;
		driver: TrackerWatchdogPort;
		snapshot: WatchdogScan;
	},
	{ decision, pane }: { decision: IdleDecision; pane: WatchdogPane },
	signal: AbortSignal
): Promise<void> {
	signal.throwIfAborted();
	const key = paneNudgeKey(pane);
	const previous = Number(store.getMeta(key) ?? 0);
	if (previous && snapshot.now - previous < sessionHealthInterval) return;
	if (decision.action === 'alert' || previous) {
		const reason =
			decision.reason ?? `Session ${pane.name} is idle again after a watchdog check-in.`;
		recordWatchdogAlert(
			store,
			{ itemId: decision.id, kind: 'idle', reason, identity: pane.key, session: pane.name },
			snapshot.now
		);
		return;
	}
	// A lost acknowledgement must not send the same input twice.
	store.writeMeta({ [key]: String(snapshot.now) });
	const { name, activity, createdAt, x, y } = pane;
	const sent = await driver.nudge(
		{
			id: key,
			itemId: decision.id,
			cli: decision.cli,
			message: nudge,
			pane: { key: pane.key, name, activity, createdAt, x, y }
		},
		signal
	);
	if (sent) {
		store.appendLocal({
			itemId: decision.id,
			fields: { 'note+': `watchdog nudge 1/1 sent to ${pane.name} on ${store.node}` }
		});
	} else {
		recordWatchdogAlert(
			store,
			{
				itemId: decision.id,
				kind: 'idle',
				reason: `Could not verify submission of the watchdog check-in in ${pane.name}.`,
				identity: pane.key,
				session: pane.name
			},
			snapshot.now,
			null
		);
	}
}

export function paneNudgeKey({ key }: WatchdogPane): string {
	return 'tracker_host_watchdog_nudge:' + createHash('sha256').update(key).digest('hex');
}
