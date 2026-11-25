// @harness-uid u_bl6xl2h4a3
import { paneNudgeKey } from './trackerHostWatchdogState';
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
		snapshot,
		settles
	}: {
		store: TrackerPersistenceService;
		driver: TrackerWatchdogPort;
		snapshot: WatchdogScan;
		/** The launcher finishes its own quiet runs, so nobody has to inspect them. */
		settles?: boolean;
	},
	{ decision, pane }: { decision: IdleDecision; pane: WatchdogPane },
	signal: AbortSignal
): Promise<void> {
	signal.throwIfAborted();
	const key = paneNudgeKey(pane);
	const previous = Number(store.getMeta(key) ?? 0);
	if (previous && snapshot.now - previous < sessionHealthInterval) return;
	if (settles && leftToLauncher(decision, pane, previous)) return;
	const alert = { itemId: decision.id, kind: 'idle', identity: pane.key, session: pane.name };
	if (decision.action === 'alert' || previous) {
		const reason =
			decision.reason ?? `Session ${pane.name} is idle again after a watchdog check-in.`;
		recordWatchdogAlert(store, { ...alert, reason }, snapshot.now);
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
		const reason = `Could not verify submission of the watchdog check-in in ${pane.name}.`;
		recordWatchdogAlert(store, { ...alert, reason }, snapshot.now, null);
	}
}

/** A launcher run that stays quiet after its check-in is finished by the final-report rule. */
function leftToLauncher(decision: IdleDecision, pane: WatchdogPane, previous: number): boolean {
	const launched = pane.runnerSocket && decision.runId !== null && !decision.reason;
	return launched && Boolean(previous || decision.action === 'alert');
}
