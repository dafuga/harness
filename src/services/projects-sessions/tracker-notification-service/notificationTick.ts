// @harness-uid u_vqnqshfas2
import type {
	TrackerDestination,
	TrackerNotificationOptions
} from '../TrackerNotificationService.types';
import type { DeliveryAttempt, TrackerNotificationState } from './notificationState.types';
import { nextAttention } from './attentionBatch';
import { nextCallback, scanCallbacks } from './callbackDelivery';
import { completeDelivery } from './completeDelivery';
import { nextDirectReminder, scanDirectReminders } from './directReminders';
import {
	currentScheduledAttempt,
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
	// An exception leaves the issued request durable. The destination must return
	// the original receipt for its id if the side effect already occurred.
	const result = await options.destinations.send(globalThis.structuredClone(attempt.request));
	options.queue.update((state) => completeDelivery(state, attempt, result, options));
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
		if (options.scheduledOnly) return;
		scanCallbacks(state, options.source, now, itemIds);
		scanDirectReminders(state, options, now);
		if (webhookReady && options.webhook) {
			scanWebhookEvents(state, options.source, options.webhook, now);
			if (options.webhook.batch === false) scanWebhookFlags(state, options, now);
			scanWebhookDue(state, options, now);
		}
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

export async function runNotificationTick(
	options: TrackerNotificationOptions,
	itemIds?: readonly string[]
): Promise<void> {
	const { chiefOfStaff, queue, source } = options;
	const { issued, paused } = queue.update((state) => {
		const issued = state.inFlight;
		if (issued?.kind === 'scheduled' && !currentScheduledAttempt(state, issued, options))
			delete state.inFlight;
		return { issued: state.inFlight, paused: Boolean(state.paused) };
	});
	if (issued) {
		if (holdIssued(issued, options, paused)) return;
		await deliver(options, issued);
	}
	const now = options.now();
	const chief = availableWebhook(options);
	scan(options, now, Boolean(chief), itemIds);
	await drain(options, (state) => nextScheduledReminder(state, options, now));
	if (options.scheduledOnly) return;
	if (chiefOfStaff && issued?.kind !== 'reminders') {
		await sendNext(options, (state) => nextDirectReminder(state, options, chiefOfStaff, now));
	}
	await drain(options, (state) => nextCallback(state, source, now));
	if (chief)
		await deliverWebhooks(options, chief, {
			now,
			recoveredAttention: issued?.kind === 'attention'
		});
}
