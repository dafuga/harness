// @harness-uid u_bl6xl2h4a3
import { createHash } from 'node:crypto';
import type { TrackerWatchdogPort } from './trackerWatchdogPort.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { urgentQueueAlertKind } from './trackerHostWatchdogAlerts';
import { launchWithoutRunKind } from './trackerWatchLaunchRequests';
import { isOutageAlert } from './trackerCosAlertKinds';
import type { TrackerWatchdogAlert } from './trackerHostWatchdog.types';

const batchSize = 8;

/** Alerts with no receipt for this queue ID or this CoS message's text. */
export function unsentCosAlerts(
	store: TrackerPersistenceService,
	alerts: readonly TrackerWatchdogAlert[]
) {
	const sent = sentIds(store);
	const seen = new Set(
		alerts.filter(({ id }) => sent.has(id)).map((alert) => messageReceiptKey(alert))
	);
	return alerts.filter((alert) => {
		const key = messageReceiptKey(alert);
		if (!key) return !sent.has(alert.id);
		if (seen.has(key) || store.getMeta(key) !== null) return false;
		seen.add(key);
		return true;
	});
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
	const batch = unsent.slice(0, driver.batchLimit ?? batchSize);
	if (!batch.length) return;
	if (!(await driver.send(batch, signal, { backlog: unsent.length > batch.length }))) return;
	recordCosReceipts(store, batch);
}

export function recordCosReceipts(
	store: TrackerPersistenceService,
	alerts: readonly TrackerWatchdogAlert[]
): void {
	if (!alerts.length) return;
	const sent = sentIds(store);
	const receipts: Record<string, string> = {};
	for (const alert of alerts) {
		sent.add(alert.id);
		const key = messageReceiptKey(alert);
		if (key) receipts[key] = '1';
	}
	store.writeMeta({ ...receipts, watchdog_cos_sent: JSON.stringify([...sent].slice(-1000)) });
}

export function cosReceiptReference(alert: TrackerWatchdogAlert): string {
	return createHash('sha256')
		.update(messageReceiptKey(alert) ?? alert.id)
		.digest('hex')
		.slice(0, 24);
}

/** Answer alerts use the answer generation. Explicit CoS messages use their full text. */
function messageReceiptKey({
	item_id,
	kind,
	identity,
	reason
}: TrackerWatchdogAlert): string | undefined {
	if (kind === 'answer-delivery') {
		const digest = createHash('sha256').update(identity).digest('hex');
		return `watchdog_cos_answer:${item_id}:${digest}`;
	}
	if (
		kind !== 'cos-message' &&
		(kind !== 'alert' || !/\bcredential\/access dependency\b/i.test(reason))
	)
		return undefined;
	const digest = createHash('sha256').update(reason).digest('hex');
	return `watchdog_cos_message:${item_id}:${digest}`;
}

function sentIds(store: TrackerPersistenceService) {
	return new Set<string>(JSON.parse(store.getMeta('watchdog_cos_sent') ?? '[]'));
}

function alertRank(kind: string) {
	if (kind === urgentQueueAlertKind) return 0;
	if (isOutageAlert(kind)) return 1;
	return kind === launchWithoutRunKind ? 2 : 3;
}
