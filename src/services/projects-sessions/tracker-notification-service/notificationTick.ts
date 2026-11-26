// @harness-uid u_vqnqshfas2
import { directReminderDestination, flagged, parkedUntil } from './notificationRules';
import type {
	TrackerDestination,
	TrackerNotificationOptions
} from '../TrackerNotificationService.types';
import type { DeliveryAttempt, TrackerNotificationState } from './notificationState.types';
import { nextAttention } from './attentionBatch';
import { nextCallback, scanCallbacks } from './callbackDelivery';
import { completeDelivery } from './completeDelivery';
import { logFailure, sendOutcome } from './deliveryOutcome';
import { currentDirectAttempt, nextDirectReminder, scanDirectReminders } from './directReminders';
import {
	currentScheduledAttempt,
	isScheduledReminderAttempt,
	nextScheduledReminder,
	scanScheduledReminders
} from './scheduledReminders';
import { nextOutbox } from './outboxRouting';
import { scanWebhookEvents } from './webhookEvents';
import { scanWebhookDue, scanWebhookFlags } from './webhookReminders';

async function deliver(
	options: TrackerNotificationOptions,
	attempt: DeliveryAttempt
): Promise<void> {
	const result = await sendOutcome(options, attempt);
	options.queue.update((state) => completeDelivery(state, attempt, result, options));
	logFailure(options, attempt, result);
}

async function sendNext(
	options: TrackerNotificationOptions,
	plan: (state: TrackerNotificationState) => DeliveryAttempt | undefined
): Promise<boolean> {
	const attempt = options.queue.update((state) => {
		state.inFlight = plan(state);
		return state.inFlight;
	});
	if (!attempt) return false;
	await deliver(options, attempt);
	return true;
}

async function drain(
	options: TrackerNotificationOptions,
	plan: (state: TrackerNotificationState) => DeliveryAttempt | undefined
): Promise<void> {
	while (await sendNext(options, plan)) {
		// Each outcome settles its rows or schedules them beyond the current tick.
	}
}

function scan(
	options: TrackerNotificationOptions,
	now: number,
	webhookReady: boolean,
	itemIds?: readonly string[]
): void {
	options.queue.update((state) => {
		scanScheduledReminders(state, options, now);
		if (options.scheduledOnly) {
			scanDirectReminders(state, options, now);
			return;
		}
		scanCallbacks(state, options.source, now, itemIds);
		if (webhookReady && options.webhook) {
			scanWebhookEvents(state, options.source, options.webhook, now);
			if (options.webhook.batch === false && !options.chiefOfStaff)
				scanWebhookFlags(state, options, now);
			scanWebhookDue(state, options, now);
		}
		scanDirectReminders(state, options, now);
	});
}

function holdIssued(
	attempt: DeliveryAttempt,
	options: TrackerNotificationOptions,
	paused: boolean
): boolean {
	if (attempt.kind !== 'outbox' && attempt.kind !== 'attention') return false;
	const chief = options.webhook?.destination;
	if (options.role !== 'hub' || !chief) return true;
	if (!paused) return false;
	if (attempt.kind === 'attention') return true;
	const { destination } = attempt.request;
	return attempt.holdWhenPaused ?? (destination.id === chief.id && destination.kind === chief.kind);
}

async function deliverWebhooks(
	options: TrackerNotificationOptions,
	destination: TrackerDestination,
	tick: { now: number; recoveredAttention: boolean }
): Promise<void> {
	await drain(options, (state) => nextOutbox(state, options, destination, tick.now));
	if (!tick.recoveredAttention)
		await sendNext(options, (state) => nextAttention(state, options, tick.now));
}

function availableWebhook(options: TrackerNotificationOptions): TrackerDestination | undefined {
	const chief = options.role === 'hub' ? options.webhook?.destination : undefined;
	return chief && options.destinations.available(chief) ? chief : undefined;
}

function issueStillCurrent(
	state: TrackerNotificationState,
	attempt: DeliveryAttempt,
	options: TrackerNotificationOptions
) {
	if (attempt.kind === 'scheduled') return currentScheduledAttempt(state, attempt, options.source);
	if (attempt.kind === 'reminders') return currentDirectAttempt(state, attempt, options);
	return askIds(state, attempt).every((id) => flagged(options.source.item(id)));
}

function askIds(state: TrackerNotificationState, attempt: DeliveryAttempt): string[] {
	if (attempt.kind === 'attention')
		return attempt.keys.flatMap((key) => {
			const row = state.attention.get(key);
			return row && (row.kind === 'needs_daniel' || row.line.needs_daniel) ? [row.itemId] : [];
		});
	if (attempt.kind === 'outbox')
		return attempt.keys.flatMap((key) => {
			const row = state.outbox.get(key);
			return row?.itemId &&
				row.payload.needs_daniel &&
				['needs_daniel', 'blocked'].includes(row.kind)
				? [row.itemId]
				: [];
		});
	if (attempt.kind === 'reminders')
		return attempt.keys.flatMap((key) => {
			const row = state.reminders.get(key);
			return row?.kind === 'flag' ? [row.itemId] : [];
		});
	return [];
}
function parkedRequest(
	state: TrackerNotificationState,
	attempt: DeliveryAttempt,
	options: TrackerNotificationOptions
): boolean {
	const { source } = options;
	const ids =
		attempt.kind === 'scheduled' || attempt.kind === 'reminders'
			? attempt.keys.flatMap((key) => state.reminders.get(key)?.itemId ?? [])
			: askIds(state, attempt);
	const now = options.now();
	return ids.some((id) => parkedUntil(source.item(id)) > now);
}
function replayState(options: TrackerNotificationOptions) {
	return options.queue.update((state) => {
		const issued = state.inFlight;
		const paused = Boolean(state.paused);
		if (!issued) return { paused };
		if (!issueStillCurrent(state, issued, options) || parkedRequest(state, issued, options)) {
			delete state.inFlight;
			return { paused };
		}
		const asking =
			askIds(state, issued).length > 0 || isScheduledReminderAttempt(state, issued, options.source);
		return {
			issued,
			paused,
			held:
				holdIssued(issued, options, paused) || (asking && pausedForChief(issued, options, paused))
		};
	});
}

function pausedForChief(
	issued: DeliveryAttempt,
	options: TrackerNotificationOptions,
	paused: boolean
) {
	return (
		paused &&
		issued.request.destination.id === options.webhook?.destination.id &&
		issued.request.destination.id !== options.chiefOfStaff?.id
	);
}

async function deliverDirectReminder(
	options: TrackerNotificationOptions,
	{ now, paused, issued }: { now: number; paused: boolean; issued?: DeliveryAttempt }
) {
	const direct = directReminderDestination(options);
	if (!direct || issued?.kind === 'reminders') return;
	if (paused && direct === options.webhook?.destination && direct !== options.chiefOfStaff) return;
	await sendNext(options, (state) => nextDirectReminder(state, options, direct, now));
}

export async function runNotificationTick(
	options: TrackerNotificationOptions,
	itemIds?: readonly string[]
): Promise<void> {
	const { issued, paused, held } = replayState(options);
	if (held) return;
	if (issued) await deliver(options, issued);
	const now = options.now();
	const chief = availableWebhook(options);
	scan(options, now, Boolean(chief), itemIds);
	await drain(options, (state) => nextScheduledReminder(state, options, now));
	await deliverDirectReminder(options, { now, paused, issued });
	if (options.scheduledOnly) return;
	await drain(options, (state) => nextCallback(state, options.source, now));
	if (chief)
		await deliverWebhooks(options, chief, {
			now,
			recoveredAttention: issued?.kind === 'attention'
		});
}
