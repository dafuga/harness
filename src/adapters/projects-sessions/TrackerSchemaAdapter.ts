// @harness-uid u_tzqekyfiyf
import { randomUUID } from 'node:crypto';
import type { SqliteDatabase, SqliteValue } from '../../core/development-tooling/sqliteTypes';
import type {
	TrackerDatabaseIdentity,
	TrackerReplayOperation,
	TrackerSchemaAdapterConfig
} from './TrackerSchemaAdapter.types';
import { trackerAreaProjection } from './tracker-schema-adapter/trackerAreaProjection';
import {
	trackerPlanningArtifactFields,
	trackerPlanningPromotionFields
} from '../../utils/projects-sessions/trackerPlanning';

export const trackerItemFields = [
	'kind',
	'title',
	'status',
	'due',
	'remind_at',
	'priority',
	'next_step',
	'parked_until',
	'owner',
	'agent',
	'notes',
	'parent',
	'needs_daniel',
	'question',
	'answer',
	'answered_at',
	'answered_by',
	'options',
	'confirm',
	'answer_option',
	'attachments',
	'attachment_docs',
	'resolved',
	'callback',
	'deleted',
	'created_at',
	'created_by',
	'blocked_reason',
	'auto',
	'project',
	'repo',
	'computer',
	'model',
	'sensitive',
	'launch_target',
	'launch_source',
	'launch_pick',
	'schedule_off',
	'schedule_hold_reason',
	'schedule_status',
	'every',
	'every_tz',
	'occurrence',
	'last_result',
	'missed',
	'ignored_reason',
	'ignored_by',
	'ignored_at',
	'ignored_until',
	'ignored_prev_status',
	'adapter_notice',
	'adapter_instructions',
	'adapter_closed',
	'adapter_due_owner',
	...trackerPlanningArtifactFields,
	...trackerPlanningPromotionFields
] as const;

const trackerSchema = `
CREATE TABLE IF NOT EXISTS items(
	id TEXT PRIMARY KEY,
	kind TEXT, title TEXT, status TEXT, due TEXT, owner TEXT, agent TEXT, notes TEXT, parent TEXT,
	needs_daniel INTEGER NOT NULL DEFAULT 0, question TEXT, answer TEXT, answered_at TEXT, answered_by TEXT,
	resolved INTEGER NOT NULL DEFAULT 0, callback TEXT, deleted INTEGER NOT NULL DEFAULT 0,
	created_at TEXT, created_by TEXT, updated_at TEXT, blocked_reason TEXT,
	clocks TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS items_status ON items(status, deleted);
CREATE TABLE IF NOT EXISTS item_notes(
	item_id TEXT NOT NULL, hlc TEXT NOT NULL, node TEXT, text TEXT NOT NULL,
	PRIMARY KEY(item_id, hlc)
);
CREATE TABLE IF NOT EXISTS ops(
	seq INTEGER PRIMARY KEY AUTOINCREMENT,
	op_id TEXT NOT NULL UNIQUE, item_id TEXT NOT NULL, fields TEXT NOT NULL,
	hlc TEXT NOT NULL, node TEXT NOT NULL, received_at INTEGER
);
CREATE INDEX IF NOT EXISTS ops_node ON ops(node, seq);
CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS agents(name TEXT PRIMARY KEY, target TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS deliveries(
	key TEXT PRIMARY KEY, item_id TEXT, target_id TEXT, target TEXT NOT NULL, events TEXT,
	status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL,
	last_error TEXT, created_at INTEGER NOT NULL, done_at INTEGER
);
CREATE TABLE IF NOT EXISTS reminders(
	key TEXT PRIMARY KEY, item_id TEXT NOT NULL, kind TEXT NOT NULL, status TEXT NOT NULL,
	next_at INTEGER NOT NULL, pings INTEGER NOT NULL DEFAULT 0, last_ping INTEGER, created_at INTEGER NOT NULL
);
`;

// Derive counts from distinct journal operations, including those stored by older replicas.
const chaseProjection = `
CREATE INDEX IF NOT EXISTS ops_tracker_chase ON ops(item_id, hlc, op_id)
	WHERE json_type(fields, '$."chase+"') IS NOT NULL;
CREATE VIEW IF NOT EXISTS tracker_item_chases AS
	SELECT chase_item_id, chased_clock, chased_by, chased_reason, chased_count
	FROM (
		SELECT item_id AS chase_item_id, hlc AS chased_clock, coalesce(actor, node) AS chased_by,
			json_extract(fields, '$."chase+"') AS chased_reason,
			count(*) OVER (PARTITION BY item_id) AS chased_count,
			row_number() OVER (PARTITION BY item_id ORDER BY hlc DESC, op_id DESC) AS latest
		FROM ops WHERE json_type(fields, '$."chase+"') IS NOT NULL
	) WHERE latest = 1;
`;

export class TrackerSchemaAdapter {
	constructor(
		private readonly database: SqliteDatabase,
		private readonly config: TrackerSchemaAdapterConfig = {}
	) {}

	/** Prepare the core Tracker tables without altering existing metadata or sync cursors. */
	initialize(): TrackerDatabaseIdentity {
		this.database.exec('BEGIN IMMEDIATE');
		try {
			this.database.exec(trackerSchema);
			this.migrateColumns();
			this.database.exec(chaseProjection);
			this.database.exec(trackerAreaProjection);
			const now = this.config.now ?? Date.now;
			const createdAt = Number(this.metadata('created_at', () => String(now())));
			const dbId = this.metadata('db_id', this.config.databaseId ?? randomUUID);
			this.database.exec('COMMIT');
			return { createdAt, dbId };
		} catch (error) {
			this.database.exec('ROLLBACK');
			throw error;
		}
	}

	getMeta(key: string): string | null {
		const row = this.database.prepare('SELECT v FROM meta WHERE k = ?').get(key) as
			| { v: string | null }
			| undefined;
		return row?.v ?? null;
	}

	setMeta(key: string, value: string | number): void {
		this.database
			.prepare('INSERT INTO meta(k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v')
			.run(key, String(value));
	}

	private migrateColumns(): void {
		const ops = this.columns('ops');
		if (!ops.has('actor')) this.database.exec('ALTER TABLE ops ADD COLUMN actor TEXT');
		const items = this.columns('items');
		const added = trackerItemFields.filter((column) => !items.has(column));
		for (const column of added) this.database.exec(`ALTER TABLE items ADD COLUMN ${column} TEXT`);
		if (added.length) this.replayAddedFields(new Set(added));
	}

	private columns(table: 'items' | 'ops'): Set<string> {
		const columns = this.database.prepare(`PRAGMA table_info(${table})`).all() as {
			name: string;
		}[];
		return new Set(columns.map(({ name }) => name));
	}

	private replayAddedFields(added: ReadonlySet<string>): void {
		const operations = this.database
			.prepare('SELECT item_id, fields, hlc FROM ops ORDER BY hlc')
			.all() as TrackerReplayOperation[];
		for (const operation of operations) this.replayOperation(operation, added);
	}

	private replayOperation(operation: TrackerReplayOperation, added: ReadonlySet<string>): void {
		const changes = Object.entries(
			JSON.parse(operation.fields) as Record<string, SqliteValue | boolean>
		);
		const projected = changes.filter(([field]) => added.has(field));
		if (!projected.length) return;
		const row = this.database
			.prepare('SELECT clocks FROM items WHERE id = ?')
			.get(operation.item_id) as { clocks: string } | undefined;
		if (!row) return;
		const clocks = JSON.parse(row.clocks) as Record<string, string>;
		for (const [field, value] of projected) {
			if (clocks[field] && clocks[field] >= operation.hlc) continue;
			clocks[field] = operation.hlc;
			this.database
				.prepare(`UPDATE items SET ${field} = ?, clocks = ? WHERE id = ?`)
				.run(
					typeof value === 'boolean' ? String(Number(value)) : (value ?? null),
					JSON.stringify(clocks),
					operation.item_id
				);
		}
	}

	private metadata(key: string, create: () => string): string {
		const previous = this.getMeta(key);
		if (previous) return previous;
		const value = create();
		this.setMeta(key, value);
		return value;
	}
}

export type {
	TrackerDatabaseIdentity,
	TrackerSchemaAdapterConfig
} from './TrackerSchemaAdapter.types';
