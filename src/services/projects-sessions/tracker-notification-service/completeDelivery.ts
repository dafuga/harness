// @harness-uid u_vqnqshfas2
import { nextReminderAt } from '../../../helpers/attention-timing/nextReminderAt';
import { quietHourBoundary } from '../../../helpers/attention-timing/quietHourBoundary';
import type {
	TrackerDeliveryResult,
	TrackerNotificationOptions
} from '../TrackerNotificationService.types';
import type {
	DeliveryAttempt,
	RetryRow,
	TrackerNotificationState
} from './notificationState.types';
import { TrackerNotificationStateError } from './TrackerNotificationStateError';
import { intervalMs } from './notificationRules';
import { quietOutboxEvent } from './outboxRouting';

const backoff = [30_000, 120_000, 600_000, 1_800_000, 3_600_000];

function recordAttempt(row: RetryRow, result: TrackerDeliveryResult): void {
	row.attempts++;
	row.lastError = result.status === 'rejected' ? result.error.slice(0, 200) : null;
}

function retryAt(attempts: number, now: number): number {
	return now + (backoff[attempts - 1] ?? 3_600_000);
}

function completeCallback(
	state: TrackerNotificationState,
	key: string,
	result: TrackerDeliveryResult,
	now: number
): void {
	const row = state.callbacks.get(key);
	if (!row)
		throw new TrackerNotificationStateError('Tracker callback attempt is missing its queue row');
	recordAttempt(row, result);
	if (result.status === 'sent') {
		row.status = 'ok';
		row.doneAt = now;
	} else {
		row.status = row.attempts >= 8 ? 'failed' : 'pending';
		row.nextAt = retryAt(row.attempts, now);
	}
}

function completeOutbox(
	state: TrackerNotificationState,
	attempt: DeliveryAttempt,
	result: TrackerDeliveryResult,
	options: TrackerNotificationOptions
): void {
	const now = options.now();
	for (const key of attempt.keys) {
		const row = state.outbox.get(key);
		if (!row)
			throw new TrackerNotificationStateError('Tracker webhook attempt is missing its queue row');
		recordAttempt(row, result);
		if (result.status === 'sent') {
			row.status = 'sent';
			row.sentAt = now;
			continue;
		}
		row.status = row.attempts >= 12 ? 'failed' : 'pending';
		const at = retryAt(row.attempts, now);
		row.nextAt = quietOutboxEvent(row) ? quietHourBoundary(at, options.quietHours) : at;
	}
}

function completeReminders(
	state: TrackerNotificationState,
	attempt: DeliveryAttempt,
	result: TrackerDeliveryResult,
	options: TrackerNotificationOptions
): void {
	const at = attempt.startedAt;
	const interval = intervalMs(options.reminderIntervalMinutes, 60);
	const retry = intervalMs(options.retryMinutes, 5);
	const next =
		result.status === 'sent'
			? nextReminderAt(at, interval, options.quietHours)
			: quietHourBoundary(at + retry, options.quietHours);
	for (const key of attempt.keys) {
		const row = state.reminders.get(key);
		if (!row)
			throw new TrackerNotificationStateError('Tracker reminder attempt is missing its queue row');
		row.nextAt = next;
		if (result.status === 'sent') {
			row.pings++;
			row.lastPing = at;
			if (row.kind === 'due') row.status = 'closed';
		}
	}
}

function completeAttention(
	state: TrackerNotificationState,
	attempt: DeliveryAttempt,
	result: TrackerDeliveryResult,
	now: number
): void {
	if (result.status === 'rejected') {
		state.lastAttentionError = result.error.slice(0, 200);
		return;
	}
	for (const key of attempt.keys) {
		const row = state.attention.get(key);
		if (!row)
			throw new TrackerNotificationStateError('Tracker attention attempt is missing its queue row');
		row.status = 'sent';
		row.sentAt = now;
		row.batchId = attempt.request.id;
	}
	state.lastAttentionSent = now;
	delete state.lastAttentionError;
}

export function completeDelivery(
	state: TrackerNotificationState,
	attempt: DeliveryAttempt,
	result: TrackerDeliveryResult,
	options: TrackerNotificationOptions
): void {
	switch (attempt.kind) {
		case 'callback':
			completeCallback(state, attempt.keys[0], result, options.now());
			break;
		case 'reminders':
			completeReminders(state, attempt, result, options);
			break;
		case 'outbox':
			completeOutbox(state, attempt, result, options);
			break;
		case 'attention':
			completeAttention(state, attempt, result, options.now());
			break;
	}
	delete state.inFlight;
}
