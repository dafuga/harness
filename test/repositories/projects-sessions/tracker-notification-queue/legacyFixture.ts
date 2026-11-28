import { withTempDir } from '../../../support/temporary';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
	clock,
	eventId,
	start
} from '../../../services/projects-sessions/tracker-notification/fixture';

// Notification DDL from Tracker 4a6be709 src/store.js and src/webhook.js.
export const legacyTables = `
CREATE TABLE deliveries(
  key TEXT PRIMARY KEY, item_id TEXT, target_id TEXT, target TEXT NOT NULL, events TEXT,
  status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL,
  last_error TEXT, created_at INTEGER NOT NULL, done_at INTEGER
);
CREATE TABLE reminders(
  key TEXT PRIMARY KEY, item_id TEXT NOT NULL, kind TEXT NOT NULL, status TEXT NOT NULL,
  next_at INTEGER NOT NULL, pings INTEGER NOT NULL DEFAULT 0, last_ping INTEGER, created_at INTEGER NOT NULL
);
CREATE TABLE webhook_outbox(
  key TEXT PRIMARY KEY, kind TEXT NOT NULL, item_id TEXT, payload TEXT NOT NULL,
  status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL,
  last_error TEXT, created_at INTEGER NOT NULL, sent_at INTEGER
);
CREATE INDEX webhook_outbox_due ON webhook_outbox(status, next_at);
CREATE TABLE cos_queue(
  key TEXT PRIMARY KEY, kind TEXT NOT NULL, item_id TEXT NOT NULL, line TEXT NOT NULL,
  status TEXT NOT NULL, created_at INTEGER NOT NULL, sent_at INTEGER, batch_id TEXT
);
CREATE TABLE cos_state(
  item_id TEXT PRIMARY KEY, status TEXT, needs INTEGER NOT NULL DEFAULT 0, resolved INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE webhook_flags(
  key TEXT PRIMARY KEY, item_id TEXT NOT NULL, status TEXT NOT NULL,
  next_at INTEGER NOT NULL, escalation INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE TABLE meta(k TEXT PRIMARY KEY, v TEXT);
`;

export const itemId = 'fixture-item';
export const reference = 'https://fixture.invalid/original';
export const callbackKey = `${itemId}|${clock()}|item`;
export const doneKey = `done|${itemId}|${clock()}`;
export const summaryKey = 'autolaunch|synthetic-run';
export const flagKey = `flag|${itemId}|${clock()}`;
export const escalationKey = `needs_daniel|${itemId}|${clock()}`;

function fixtureFiles(dir: string) {
	const handles: DatabaseSync[] = [];
	return {
		open(name = 'tracker.sqlite') {
			const database = new DatabaseSync(join(dir, name));
			handles.push(database);
			return database;
		},
		close(database: DatabaseSync) {
			database.close();
			handles.splice(handles.indexOf(database), 1);
		},
		closeAll() {
			for (const database of handles) database.close();
		}
	};
}

export function withFixtureFiles<T>(
	use: (files: ReturnType<typeof fixtureFiles>) => T | Promise<T>
): Promise<T> {
	return withTempDir('tracker-notification-fixture-', async (dir) => {
		const files = fixtureFiles(dir);
		try {
			return await use(files);
		} finally {
			files.closeAll();
		}
	});
}

export function putCallback(database: DatabaseSync, at: number, status = 'pending') {
	database
		.prepare('INSERT INTO deliveries VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
		.run(
			callbackKey,
			itemId,
			'item',
			`{ "url": "${reference}", "node": "fixture-node" }`,
			'[ "done" ]',
			status,
			2,
			at,
			'previous outcome',
			start - 60_000,
			null
		);
}

export function putOutbox(database: DatabaseSync, key: string, at: number) {
	const routed = key === doneKey;
	const kind = routed ? 'done' : 'autolaunch';
	const payload = {
		event_id: eventId(key),
		event: kind,
		item_id: routed ? itemId : null,
		needs_daniel: false,
		escalation: 0,
		owner: routed ? 'fixture-agent' : null,
		title: 'Recovered notification'
	};
	database
		.prepare('INSERT INTO webhook_outbox VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
		.run(
			key,
			kind,
			payload.item_id,
			JSON.stringify(payload, null, 2),
			'pending',
			3,
			at,
			'previous webhook outcome',
			start - 60_000,
			null
		);
}

export function putMetadata(database: DatabaseSync) {
	const put = database.prepare('INSERT INTO meta VALUES(?, ?)');
	const iso = new Date(start - 60_000).toISOString();
	put.run('created_at', String(start - 60_000));
	put.run('db_id', 'fixture-db');
	put.run('webhook_seq', '17');
	put.run('sync_cursor:hub', '44');
	put.run('webhook_paused', `{ "at": "${iso}", "by": "fixture-operator" }`);
	put.run('cos_init', iso);
	put.run('cos_force', '1');
	put.run('cos_last_attempt_at', String(start - 120_000));
	put.run('cos_last_sent_at', String(start - 180_000));
	put.run('cos_last_error', 'synthetic previous error');
}

export function putAttention(database: DatabaseSync) {
	database.prepare('INSERT INTO cos_state VALUES(?, ?, ?, ?)').run(itemId, 'done', 0, 0);
	database.prepare('INSERT INTO cos_queue VALUES(?, ?, ?, ?, ?, ?, ?, ?)').run(
		doneKey,
		'done',
		itemId,
		JSON.stringify({
			event: 'done',
			item_id: itemId,
			title: 'Recovered notification',
			at: new Date(start).toISOString()
		}),
		'pending',
		start - 60_000,
		null,
		null
	);
}

export function putReminders(database: DatabaseSync) {
	database
		.prepare('INSERT INTO reminders VALUES(?, ?, ?, ?, ?, ?, ?, ?)')
		.run(flagKey, itemId, 'flag', 'active', start + 1000, 2, start - 1000, start - 60_000);
	database
		.prepare('INSERT INTO webhook_flags VALUES(?, ?, ?, ?, ?, ?)')
		.run(escalationKey, itemId, 'active', start + 1000, 2, start - 60_000);
}

export function legacySnapshot(database: DatabaseSync) {
	const tables = [
		'deliveries',
		'reminders',
		'webhook_outbox',
		'webhook_flags',
		'cos_queue',
		'cos_state',
		'meta'
	];
	return tables.map((table) => {
		const columns =
			table === 'reminders' ? 'key,item_id,kind,status,next_at,pings,last_ping,created_at' : '*';
		const scope = table === 'meta' ? " WHERE k <> 'chief_review_migrated'" : '';
		return database.prepare(`SELECT ${columns} FROM ${table}${scope} ORDER BY rowid`).all();
	});
}
