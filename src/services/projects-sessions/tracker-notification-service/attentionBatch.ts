// @harness-uid u_vqnqshfas2
import { groupAttentionLines } from '../../../helpers/attention-timing/groupAttentionLines';
import { nextAttentionBatchAt } from '../../../helpers/attention-timing/nextAttentionBatchAt';
import { quietHourBoundary } from '../../../helpers/attention-timing/quietHourBoundary';
import type {
	TrackerNotificationItem,
	TrackerNotificationOptions,
	TrackerNotificationSource,
	TrackerWebhookOptions
} from '../TrackerNotificationService.types';
import type {
	AttentionPayload,
	AttentionRow,
	DeliveryAttempt,
	TrackerNotificationState
} from './notificationState.types';
import { webhookRequest } from './deliveryRequest';
import {
	danielQuietHours,
	eventId,
	flagged,
	isoTime,
	minute,
	parkedUntil
} from './notificationRules';

function waitingToLaunch(
	entry: AttentionRow,
	item: TrackerNotificationItem,
	source: TrackerNotificationSource
): boolean {
	const { token } = entry.line;
	return (
		typeof token === 'string' &&
		item.auto === token &&
		item.status !== 'done' &&
		item.status !== 'blocked' &&
		!source.launchStarted(item.id, token)
	);
}

function stillRelevant(entry: AttentionRow, source: TrackerNotificationSource): boolean {
	const item = source.item(entry.itemId);
	if (!item || item.deleted || item.status === 'ignored') return false;
	if (entry.kind === 'done') return item.status === 'done';
	if (item.chief_review) return false;
	if (Date.parse(item.remind_at ?? '') > Date.parse(entry.line.at)) return false;
	if (entry.kind === 'blocked') return stillBlocked(entry, item);
	if (entry.kind === 'needs_daniel') return flagged(item);
	return waitingToLaunch(entry, item, source);
}

function stillBlocked(entry: AttentionRow, item: TrackerNotificationItem): boolean {
	return item.status === 'blocked' && (!entry.line.needs_daniel || flagged(item));
}

function eligibleLines(
	state: TrackerNotificationState,
	source: TrackerNotificationSource
): AttentionRow[] {
	const eligible = [];
	for (const entry of state.attention.values()) {
		if (entry.status !== 'pending') continue;
		if (stillRelevant(entry, source)) eligible.push(entry);
		else entry.status = 'dropped';
	}
	return eligible.sort((a, b) => a.createdAt - b.createdAt);
}

function lineText(line: AttentionPayload): string {
	const title = line.title ?? '';
	if (line.event === 'launch_wait')
		return `LAUNCH WAITING: ${title} on ${line.computer} - ${line.reason}`;
	if (line.event === 'done') return `DONE: ${title}${line.result ? ` - ${line.result}` : ''}`;
	if (line.event === 'needs_daniel')
		return `NEEDS DANIEL: ${title}${line.question ? ` - ${line.question}` : ''}`;
	return `BLOCKED: ${title}${line.reason ? ` - ${line.reason}` : ''}${line.needs_daniel ? ' (needs Daniel)' : ''}`;
}

function canSendAttention(
	state: TrackerNotificationState,
	options: TrackerNotificationOptions & { webhook: TrackerWebhookOptions },
	pending: AttentionRow[],
	now: number
): boolean {
	const { webhook } = options;
	const { forceAttention: forced } = state;
	const at = nextAttentionBatchAt({
		nowMs: now,
		windowMs: (webhook.windowMinutes ?? 30) * minute,
		paused: !!state.paused,
		forced: !!forced,
		pending: pending.map((row) => ({ kind: row.kind, createdAtMs: row.createdAt })),
		lastAttemptMs: state.lastAttentionAttempt ?? null,
		urgentKinds: webhook.urgent ?? [],
		windowAlignedKinds: ['launch_wait'],
		quietHold: false,
		quiet: null
	});
	return at !== null && at <= now;
}

function nextSuggestion(
	state: TrackerNotificationState,
	{ suggestions }: TrackerWebhookOptions,
	now: number
): string | undefined {
	if (!suggestions?.length || quietHourBoundary(now, danielQuietHours) > now) return undefined;
	return suggestions[(state.digestsSent ?? 0) % suggestions.length];
}

function prepareAttention(
	state: TrackerNotificationState,
	pending: AttentionRow[],
	options: TrackerNotificationOptions & { webhook: TrackerWebhookOptions },
	now: number
): DeliveryAttempt {
	const { source, webhook } = options;
	const forced = !!state.forceAttention;
	const windowMinutes = webhook.windowMinutes ?? 30;

	const group = groupAttentionLines(
		pending.map((row) => ({ ...row, atMs: Date.parse(row.line.at) }))
	);
	const items = group.lines.map(({ line }) => {
		if (line.event !== 'needs_daniel' && !line.needs_daniel) return line;
		const at = Date.parse(line.at);
		return {
			...line,
			first_noticed_at: line.at,
			waiting_minutes: Math.max(0, Math.floor((now - at) / minute))
		};
	});
	const suggestion = nextSuggestion(state, webhook, now);
	const text = items.map(lineText);
	if (suggestion) text.push(`Until the next digest: ${suggestion}`);
	const keys = group.lines.map((row) => row.key);
	const included = new Set(keys);
	for (const row of pending) if (!included.has(row.key)) row.status = 'dropped';
	const request = webhookRequest(webhook.destination, {
		event_id: eventId(keys),
		event: 'attention',
		to: 'chief_of_staff',
		batch: true,
		catch_up: forced,
		window_minutes: windowMinutes,
		count: items.length,
		counts: group.counts,
		items,
		text: text.join('\n'),
		...(suggestion && { suggestion }),
		node: source.node,
		sent_at: isoTime(now)
	});
	state.lastAttentionAttempt = now;
	delete state.forceAttention;
	return { kind: 'attention', keys, request, startedAt: now };
}

export function nextAttention(
	state: TrackerNotificationState,
	options: TrackerNotificationOptions,
	now: number
): DeliveryAttempt | undefined {
	const { webhook, source } = options;
	if (!webhook || webhook.batch === false) return undefined;
	const pending = eligibleLines(state, source);
	if (!pending.length) {
		delete state.forceAttention;
		return undefined;
	}
	const sendable = pending.filter(({ line, itemId }) => {
		if (line.event !== 'needs_daniel' && !line.needs_daniel) return true;
		return parkedUntil(source.item(itemId)) <= now;
	});
	const configured = { ...options, webhook };
	if (!sendable.length || !canSendAttention(state, configured, sendable, now)) return undefined;
	return prepareAttention(state, sendable, configured, now);
}
