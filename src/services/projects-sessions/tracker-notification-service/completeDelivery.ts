// @harness-uid u_vqnqshfas2
import type {
	TrackerDeliveryResult,
	TrackerNotificationOptions
} from '../TrackerNotificationService.types';
import type {
	DeliveryAttempt,
	ReminderRow,
	RetryRow,
	TrackerNotificationState
} from './notificationState.types';
import { TrackerNotificationStateError } from './TrackerNotificationStateError';
import { intervalMs, nextAskAt } from './notificationRules';

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
		row.nextAt = retryAt(row.attempts, now);
	}
}

function completeReminders(
	state: TrackerNotificationState,
	attempt: DeliveryAttempt,
	result: TrackerDeliveryResult,
	options: TrackerNotificationOptions
): void {
	// A replayed attempt can be old: time a retry from now so it cannot be due at once.
	const at = result.status === 'sent' ? attempt.startedAt : options.now();
	const interval = intervalMs(options.reminderIntervalMinutes, 60);
	const retry = intervalMs(options.retryMinutes, 5);
	const next = at + (result.status === 'sent' ? interval : retry);
	for (const key of attempt.keys) {
		const row = state.reminders.get(key);
		if (!row)
			throw new TrackerNotificationStateError('Tracker reminder attempt is missing its queue row');
		row.nextAt = row.kind === 'scheduled' ? at + retry : next;
		const repeating = repeatsReminder(row, options);
		if (repeating) scheduleNextAsk(row, result, { at, retry });
		if (result.status === 'sent') {
			row.pings++;
			row.lastPing = at;
			if (!repeating) row.status = 'closed';
		}
	}
}

function repeatsReminder(row: ReminderRow, { source }: TrackerNotificationOptions) {
	return (
		row.kind === 'flag' ||
		(row.kind === 'scheduled' && source.item(row.itemId)?.kind === 'reminder')
	);
}

function scheduleNextAsk(
	row: ReminderRow,
	result: TrackerDeliveryResult,
	{ at, retry }: { at: number; retry: number }
) {
	if (result.status === 'sent') {
		row.firstPing ??= row.lastPing ?? at;
		row.nextAt = nextAskAt(row.pings + 1, row.firstPing, at);
	} else {
		row.nextAt = at + retry;
	}
}

/** A busy target never saw the digest, so its window reopens after a short wait. */
const busyRetry = 2 * 60_000;

function completeAttention(
	state: TrackerNotificationState,
	attempt: DeliveryAttempt,
	result: TrackerDeliveryResult,
	options: TrackerNotificationOptions
): void {
	const now = options.now();
	if (result.status === 'rejected') {
		state.lastAttentionError = result.error.slice(0, 200);
		const window = intervalMs(options.webhook?.windowMinutes, 30);
		if (result.busy) state.lastAttentionAttempt = Math.max(0, now - window + busyRetry);
		return;
	}
	state.digestsSent = (state.digestsSent ?? 0) + 1;
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
		case 'scheduled':
		case 'reminders':
			completeReminders(state, attempt, result, options);
			break;
		case 'outbox':
			completeOutbox(state, attempt, result, options);
			break;
		case 'attention':
			completeAttention(state, attempt, result, options);
			break;
	}
	delete state.inFlight;
}
