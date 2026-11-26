// @harness-uid u_e7x5dhawh4
import { z } from 'zod';
import type { SqliteDatabase } from '../../../core/development-tooling/sqliteTypes';
import type {
	DeliveryAttempt,
	TrackerNotificationState
} from '../../../services/projects-sessions/tracker-notification-service/notificationState.types';
import { TrackerNotificationQueueError } from './TrackerNotificationQueueError';

const attemptSchema = z.strictObject({
	kind: z.enum(['callback', 'reminders', 'outbox', 'attention', 'scheduled']),
	keys: z.array(z.string()).min(1),
	startedAt: z.number().int().nonnegative(),
	holdWhenPaused: z.boolean().optional(),
	request: z.strictObject({
		id: z.string().min(1),
		destination: z.strictObject({ kind: z.enum(['http', 'command']), id: z.string().min(1) }),
		body: z.string(),
		headers: z.record(z.string(), z.string()).optional(),
		environment: z.record(z.string(), z.string()).optional()
	})
});
const pauseSchema = z.object({ at: z.string(), by: z.string().nullable() });
const metadataKeys = [
	'webhook_seq',
	'webhook_paused',
	'cos_init',
	'cos_force',
	'cos_last_attempt_at',
	'cos_last_sent_at',
	'cos_last_error',
	'cos_digests_sent'
];

function integer(value: string | undefined, key: string): number | undefined {
	if (value === undefined) return undefined;
	const number = Number(value);
	if (!/^\d+$/.test(value) || !Number.isSafeInteger(number))
		throw new TrackerNotificationQueueError(`Invalid Tracker notification metadata: ${key}`);
	return number;
}

function parsePause(value: string | undefined): TrackerNotificationState['paused'] {
	if (!value) return undefined;
	const { at, by } = pauseSchema.parse(JSON.parse(value));
	const time = Date.parse(at);
	if (!Number.isFinite(time))
		throw new TrackerNotificationQueueError(
			'Invalid Tracker notification metadata: webhook_paused'
		);
	return { at: time, by };
}

function readAttempt(database: SqliteDatabase): DeliveryAttempt | undefined {
	const row = database
		.prepare('SELECT attempt FROM harness_notification_inflight WHERE slot = 1')
		.get() as { attempt: string } | undefined;
	if (!row) return undefined;
	const attempt: unknown = JSON.parse(row.attempt);
	validateAttempt(attempt);
	return attempt;
}

function validateAttempt(attempt: unknown): asserts attempt is DeliveryAttempt {
	if (!attemptSchema.safeParse(attempt).success)
		throw new TrackerNotificationQueueError('Invalid persisted Tracker notification attempt');
}

export function readQueueMetadata(database: SqliteDatabase) {
	const rows = database
		.prepare(
			`SELECT k, v FROM meta WHERE k IN (${metadataKeys.map(() => '?').join(', ')}) AND v IS NOT NULL`
		)
		.all(...metadataKeys) as { k: string; v: string }[];
	const values = new Map(rows.map(({ k, v }) => [k, v]));
	return {
		cursor: integer(values.get('webhook_seq'), 'webhook_seq') ?? null,
		paused: parsePause(values.get('webhook_paused')),
		attentionInitialized: Boolean(values.get('cos_init')),
		forceAttention: Boolean(values.get('cos_force')),
		lastAttentionAttempt: integer(values.get('cos_last_attempt_at'), 'cos_last_attempt_at'),
		lastAttentionSent: integer(values.get('cos_last_sent_at'), 'cos_last_sent_at'),
		lastAttentionError: values.get('cos_last_error'),
		digestsSent: integer(values.get('cos_digests_sent'), 'cos_digests_sent'),
		inFlight: readAttempt(database)
	};
}

function metadataValues(state: TrackerNotificationState) {
	return [
		state.cursor,
		state.paused &&
			JSON.stringify({ at: new Date(state.paused.at).toISOString(), by: state.paused.by }),
		state.attentionInitialized ? '1' : null,
		state.forceAttention ? '1' : null,
		state.lastAttentionAttempt,
		state.lastAttentionSent,
		state.lastAttentionError,
		state.digestsSent
	];
}

export function writeQueueMetadata(
	database: SqliteDatabase,
	before: TrackerNotificationState,
	after: TrackerNotificationState,
	now: () => number
): void {
	const previous = metadataValues(before);
	const values = metadataValues(after);
	for (const [index, key] of metadataKeys.entries()) {
		const value = values[index] ?? null;
		if ((previous[index] ?? null) === value) continue;
		if (value === null) database.prepare('DELETE FROM meta WHERE k = ?').run(key);
		else
			database
				.prepare('INSERT INTO meta(k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v')
				.run(key, key === 'cos_init' ? new Date(now()).toISOString() : String(value));
	}
	writeAttempt(database, before.inFlight, after.inFlight);
}

function writeAttempt(
	database: SqliteDatabase,
	before: DeliveryAttempt | undefined,
	after: DeliveryAttempt | undefined
): void {
	const attempt = after && JSON.stringify(after);
	if (attempt === (before && JSON.stringify(before))) return;
	if (attempt) {
		validateAttempt(after);
		database
			.prepare(
				'INSERT INTO harness_notification_inflight(slot, attempt) VALUES (1, ?) ON CONFLICT(slot) DO UPDATE SET attempt = excluded.attempt'
			)
			.run(attempt);
	} else database.prepare('DELETE FROM harness_notification_inflight WHERE slot = 1').run();
}
