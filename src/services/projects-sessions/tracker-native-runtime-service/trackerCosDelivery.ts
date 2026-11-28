// @harness-uid u_bl6xl2h4a3
import { randomBytes } from 'node:crypto';
import { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { isOutageAlert } from './trackerCosAlertKinds';
import { cosDeliveryAsk, cosDeliveryDelivered } from './trackerCosDeliveryAsk';
import { cosSendWindowStart } from './trackerCosWindow';
import type { TrackerWatchdogAlert } from './trackerHostWatchdog.types';
import type { TrackerCosDeliveryAlarm } from './trackerCosDelivery.types';

const minute = 60_000;
const routineGrace = 60 * minute;
const outageGrace = 15 * minute;
const askAgainAfter = 4 * 60 * minute;
const metaKey = 'watchdog_cos_alarm';
const alphabet = '0123456789abcdefghjkmnpqrstvwxyz';

/**
 * The tmux-independent path: when alerts stay unsent, ask Daniel through the Tracker itself, which
 * the Tracker, Hub, Mac and iOS apps read without any Chief of Staff session.
 */
export function watchCosDelivery(
	store: TrackerPersistenceService,
	pending: readonly TrackerWatchdogAlert[],
	now: number,
	progressExpected = false
): void {
	const windowStart = cosSendWindowStart(now);
	if (windowStart === null) return;
	const alarm = readAlarm(store);
	// Overdue by real age keeps an ask open; only waiting time in today's window raises one.
	if (!pending.some((alert) => overdue(alert, now - alert.at))) {
		if (alarm?.open) closeAlarm(store, alarm);
		return;
	}
	if (progressExpected) return;
	const stuck = pending.some((alert) => overdue(alert, now - Math.max(alert.at, windowStart)));
	if (stuck && askDue(store, alarm, now)) raiseAlarm(store, { alarm, pending, now });
}

function overdue({ kind }: TrackerWatchdogAlert, waited: number) {
	return waited > (isOutageAlert(kind) ? outageGrace : routineGrace);
}

function readAlarm(store: TrackerPersistenceService): TrackerCosDeliveryAlarm | undefined {
	const stored = store.getMeta(metaKey);
	return stored ? (JSON.parse(stored) as TrackerCosDeliveryAlarm) : undefined;
}

function askDue(
	store: TrackerPersistenceService,
	alarm: TrackerCosDeliveryAlarm | undefined,
	now: number
) {
	if (!alarm?.open) return true;
	const item = new TrackerItemReadRepository(store.database).getStored(alarm.itemId);
	const asking = item.needs_daniel && !item.resolved && item.status !== 'done';
	return !asking && now - alarm.askedAt >= askAgainAfter;
}

function raiseAlarm(
	store: TrackerPersistenceService,
	{
		alarm,
		pending,
		now
	}: { alarm?: TrackerCosDeliveryAlarm; pending: readonly TrackerWatchdogAlert[]; now: number }
) {
	const itemId = alarm?.itemId ?? newItemId();
	const next = { itemId, open: true, askedAt: now };
	store.appendLocal(
		{ itemId, fields: cosDeliveryAsk({ pending, now, node: store.node, created: !alarm }) },
		() => store.writeMeta({ [metaKey]: JSON.stringify(next) })
	);
}

function closeAlarm(store: TrackerPersistenceService, alarm: TrackerCosDeliveryAlarm) {
	store.appendLocal({ itemId: alarm.itemId, fields: cosDeliveryDelivered }, () =>
		store.writeMeta({ [metaKey]: JSON.stringify({ ...alarm, open: false }) })
	);
}

function newItemId() {
	return Array.from(randomBytes(10), (byte) => alphabet[byte & 31]).join('');
}
