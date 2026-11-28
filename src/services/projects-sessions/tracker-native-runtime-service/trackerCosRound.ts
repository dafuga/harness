// @harness-uid u_bl6xl2h4a3
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
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
	const { now, local, current = () => true } = ports;
	let lastRun = -Infinity;
	let peerAlerts: readonly TrackerWatchdogAlert[] = [];
	const alerts = () => [...local(), ...peerAlerts].filter(current);
	return {
		alerts,
		async run(signal: AbortSignal, urgent: boolean) {
			if (!urgent && now() - lastRun < interval) return;
			lastRun = now();
			peerAlerts = (await driver.peers?.(signal)) ?? [];
			const deliverable = alerts().filter(({ kind }) => kind !== 'missing' && kind !== 'context');
			const pending = unsentCosAlerts(store, deliverable);
			const confirmed =
				pending.length && (await driver.receipts?.(pending, signal).catch(() => undefined));
			signal.throwIfAborted();
			if (confirmed)
				recordCosReceipts(
					store,
					pending.filter(({ id }) => confirmed.has(id))
				);
			const stillDeliverable = deliverable.filter(current);
			let progressExpected = false;
			try {
				progressExpected =
					(await sendWatchdogAlerts(store, driver, stillDeliverable, signal)) !== false;
			} finally {
				if (!signal.aborted)
					watchCosDelivery(
						store,
						unsentCosAlerts(store, stillDeliverable.filter(current)),
						now(),
						progressExpected
					);
			}
		}
	};
}
