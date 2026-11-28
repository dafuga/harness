// @harness-uid u_bl6xl2h4a3
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { trackerChiefReviewAlerts } from './trackerChiefReviewQueue';
import { watchCosDelivery } from './trackerCosDelivery';
import { recordCosReceipts, sendWatchdogAlerts, unsentCosAlerts } from './trackerHostCos';
import type { TrackerWatchdogAlert } from './trackerHostWatchdog.types';
import type { TrackerWatchdogPort } from './trackerWatchdogPort.types';
import type { TrackerCosRoundPorts } from './trackerCosDelivery.types';

const interval = 60_000;

/** Once a minute: refresh the other computer's alerts, check for stuck delivery, then send. */
export function trackerCosRound(
	store: TrackerPersistenceService,
	driver: TrackerWatchdogPort,
	ports: TrackerCosRoundPorts
) {
	const { now, local } = ports;
	let lastRun = -Infinity;
	let peerAlerts: readonly TrackerWatchdogAlert[] = [];
	const alerts = () => [...local(), ...peerAlerts, ...trackerChiefReviewAlerts(store)];
	return {
		alerts,
		async run(signal: AbortSignal, urgent: boolean) {
			if (!urgent && now() - lastRun < interval) return;
			lastRun = now();
			peerAlerts = (await driver.peers?.(signal)) ?? [];
			const deliverable = alerts().filter(({ kind }) => kind !== 'missing');
			const pending = unsentCosAlerts(store, deliverable);
			const confirmed =
				pending.length && (await driver.receipts?.(pending, signal).catch(() => undefined));
			signal.throwIfAborted();
			if (confirmed)
				recordCosReceipts(
					store,
					pending.filter(({ id }) => confirmed.has(id))
				);
			// Checked before sending, so a send that throws cannot hide the backlog.
			watchCosDelivery(store, unsentCosAlerts(store, deliverable), now());
			await sendWatchdogAlerts(store, driver, deliverable, signal);
		}
	};
}
