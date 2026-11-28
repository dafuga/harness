// @harness-uid u_bl6xl2h4a3
import { randomBytes } from 'node:crypto';
import { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { cosOutageGrace, isOutageAlert } from './trackerCosAlertKinds';
import { cosDeliveryAsk, cosDeliveryDelivered } from './trackerCosDeliveryAsk';
import { cosSendWindowStart } from './trackerCosWindow';
import type { TrackerWatchdogAlert } from './trackerHostWatchdog.types';
import type { TrackerCosBusyPane, TrackerCosDeliveryAlarm } from './trackerCosDelivery.types';
import type { CosSendResult } from './trackerWatchdogPort.types';

const minute = 60_000;
const routineGrace = 60 * minute;
const askAgainAfter = 4 * 60 * minute;
const metaKey = 'watchdog_cos_alarm';
const busyKey = 'watchdog_cos_busy_pane';
const alphabet = '0123456789abcdefghjkmnpqrstvwxyz';

/**
 * The tmux-independent path: when alerts stay unsent, ask Daniel through the Tracker itself, which
 * the Tracker, Hub, Mac and iOS apps read without any Chief of Staff session.
 */
export function watchCosDelivery(
	store: TrackerPersistenceService,
	pending: readonly TrackerWatchdogAlert[],
	now: number,
	result: CosSendResult = false
): void {
	if (!pending.length) {
		closeRecoveredAlarm(store, now);
		return;
	}
	const windowStart = cosSendWindowStart(now);
	const busy = busySince(store, typeof result === 'object' ? result.busyPane : undefined, now);
	if (windowStart === null || result === true || result === 'deferred') return;
	if (!deliveryStuck(pending, { now, windowStart, busy, unreachable: result === false })) return;
	const alarm = readAlarm(store);
	if (askDue(store, alarm, now)) raiseAlarm(store, { alarm, pending, now });
}

function deliveryStuck(
	pending: readonly TrackerWatchdogAlert[],
	{
		now,
		windowStart,
		busy,
		unreachable
	}: {
		now: number;
		windowStart: number;
		busy?: number;
		unreachable: boolean;
	}
) {
	if (busy !== undefined && now - Math.max(busy, windowStart) >= cosOutageGrace) return true;
	return pending.some(({ kind, at }) => {
		const waited = now - Math.max(at, windowStart);
		return isOutageAlert(kind) ? waited >= cosOutageGrace : unreachable && waited >= routineGrace;
	});
}

function busySince(store: TrackerPersistenceService, pane: string | undefined, now: number) {
	const stored = store.getMeta(busyKey);
	const busy = stored ? (JSON.parse(stored) as TrackerCosBusyPane) : undefined;
	if (!pane) {
		if (stored) store.writeMeta({ [busyKey]: '' });
		return undefined;
	}
	if (busy?.pane === pane) return busy.since;
	store.writeMeta({ [busyKey]: JSON.stringify({ pane, since: now }) });
	return now;
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
	if (new TrackerItemReadRepository(store.database).getStored(alarm.itemId).status === 'done') {
		store.writeMeta({ [metaKey]: JSON.stringify({ ...alarm, open: false }) });
		return;
	}
	store.appendLocal({ itemId: alarm.itemId, fields: cosDeliveryDelivered }, () =>
		store.writeMeta({ [metaKey]: JSON.stringify({ ...alarm, open: false }) })
	);
}

function closeRecoveredAlarm(store: TrackerPersistenceService, now: number) {
	busySince(store, undefined, now);
	const alarm = readAlarm(store);
	if (alarm?.open) closeAlarm(store, alarm);
}

function newItemId() {
	return Array.from(randomBytes(10), (byte) => alphabet[byte & 31]).join('');
}
