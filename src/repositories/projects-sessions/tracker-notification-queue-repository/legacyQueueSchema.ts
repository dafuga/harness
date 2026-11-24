// @harness-uid u_e7x5dhawh4
import type { SqliteDatabase } from '../../../core/development-tooling/sqliteTypes';
import { TrackerNotificationQueueError } from './TrackerNotificationQueueError';

// The core Tracker schema already creates deliveries, reminders and meta.
// These tables match Tracker 4a6be709 src/webhook.js. The last table is native-only.
const notificationSchema = `
CREATE TABLE IF NOT EXISTS webhook_outbox(
	key TEXT PRIMARY KEY, kind TEXT NOT NULL, item_id TEXT, payload TEXT NOT NULL,
	status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL,
	last_error TEXT, created_at INTEGER NOT NULL, sent_at INTEGER
);
CREATE INDEX IF NOT EXISTS webhook_outbox_due ON webhook_outbox(status, next_at);
CREATE TABLE IF NOT EXISTS cos_queue(
	key TEXT PRIMARY KEY, kind TEXT NOT NULL, item_id TEXT NOT NULL, line TEXT NOT NULL,
	status TEXT NOT NULL, created_at INTEGER NOT NULL, sent_at INTEGER, batch_id TEXT
);
CREATE TABLE IF NOT EXISTS cos_state(
	item_id TEXT PRIMARY KEY, status TEXT, needs INTEGER NOT NULL DEFAULT 0, resolved INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS webhook_flags(
	key TEXT PRIMARY KEY, item_id TEXT NOT NULL, status TEXT NOT NULL,
	next_at INTEGER NOT NULL, escalation INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS harness_notification_inflight(
	slot INTEGER PRIMARY KEY CHECK(slot = 1), attempt TEXT NOT NULL
);
`;

export function initializeQueueSchema(database: SqliteDatabase): void {
	database.exec(notificationSchema);
	const columns = database.prepare('PRAGMA table_info(reminders)').all() as { name: string }[];
	if (columns.length && !columns.some(({ name }) => name === 'first_ping'))
		database.exec('ALTER TABLE reminders ADD COLUMN first_ping INTEGER');
}

export function validateQueueTable(
	database: SqliteDatabase,
	table: string,
	key: string,
	columns: readonly string[]
): void {
	const existing = database.prepare(`PRAGMA table_info(${table})`).all() as {
		name: string;
		pk: number;
	}[];
	const keys = existing.filter((column) => column.pk);
	if (
		keys.length !== 1 ||
		keys[0]?.name !== key ||
		columns.some((name) => !existing.some((column) => column.name === name))
	)
		throw new TrackerNotificationQueueError(`Incompatible Tracker notification schema: ${table}`);
}
