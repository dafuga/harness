// @harness-uid u_bl6xl2h4a3
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { watchCosDelivery } from './trackerCosDelivery';
import { recordCosReceipts, sendWatchdogAlerts, unsentCosAlerts } from './trackerHostCos';
import type { TrackerWatchdogAlert } from './trackerHostWatchdog.types';
import type { CosSendResult, TrackerWatchdogPort } from './trackerWatchdogPort.types';
import type { TrackerCosRoundPorts } from './trackerCosDelivery.types';

const interval = 60_000;

/** Once a minute: refresh both queues, try delivery, and reconcile the escalation with receipts. */
export function trackerCosRound(
	store: TrackerPersistenceService,
	driver: TrackerWatchdogPort,
	ports: TrackerCosRoundPorts
) {
	const { now, local } = ports;
	let lastRun = -Infinity;
	let peerAlerts: readonly TrackerWatchdogAlert[] = [];
	const alerts = () => [...local(), ...peerAlerts];
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
			let result: CosSendResult = false;
			try {
				result = await sendWatchdogAlerts(store, driver, deliverable, signal);
			} finally {
				if (!signal.aborted)
					watchCosDelivery(store, unsentCosAlerts(store, deliverable), now(), result);
			}
		}
	};
}
