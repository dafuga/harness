// @harness-uid u_vglplkno45
import type { SqliteDatabase } from '../../core/development-tooling/sqliteTypes';
import type {
	TrackerAdapterListRow,
	TrackerStoredAdapterSource,
	TrackerAdapterSourceAction,
	TrackerAdapterSourceRow
} from './TrackerAdapterRepository.types';

const schema = `
CREATE TABLE IF NOT EXISTS adapter_runner(
	slot INTEGER PRIMARY KEY CHECK(slot = 1), node TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS adapter_sources(
	id TEXT PRIMARY KEY, config TEXT NOT NULL, enabled_at INTEGER NOT NULL, cursor INTEGER NOT NULL,
	paused INTEGER NOT NULL DEFAULT 0, removed INTEGER NOT NULL DEFAULT 0, last_run INTEGER, last_error TEXT
);
CREATE TABLE IF NOT EXISTS adapter_links(
	source_id TEXT NOT NULL, external_id TEXT NOT NULL, external_key TEXT NOT NULL, item_id TEXT NOT NULL,
	remote_state TEXT, events_after INTEGER NOT NULL, owned INTEGER NOT NULL, sync_pending INTEGER NOT NULL,
	PRIMARY KEY(source_id, external_id)
);
CREATE INDEX IF NOT EXISTS adapter_pending ON adapter_links(source_id, sync_pending);
CREATE INDEX IF NOT EXISTS adapter_keys ON adapter_links(source_id, external_key);
CREATE TABLE IF NOT EXISTS adapter_events(
	source_id TEXT NOT NULL, external_id TEXT NOT NULL, event_id TEXT NOT NULL,
	PRIMARY KEY(source_id, external_id, event_id)
);
`;

const sourceChanges = {
	pause: ['paused', 1],
	resume: ['paused', 0],
	remove: ['removed', 1]
} as const;

/** Maintain the designated runner and persisted polling watermark. */
export class TrackerAdapterSourceRepository {
	constructor(private readonly database: SqliteDatabase) {}

	initialize(): void {
		this.database.exec(schema);
	}

	isInitialized(): boolean {
		return Boolean(
			this.database
				.prepare("SELECT 1 FROM sqlite_master WHERE name = 'adapter_sources' AND type = 'table'")
				.get()
		);
	}

	isOwner(node: string, register: boolean): boolean {
		if (register)
			this.database
				.prepare('INSERT OR IGNORE INTO adapter_runner(slot, node) VALUES (1, ?)')
				.run(node);
		const runner = this.runner();
		return !runner || runner === node;
	}

	runner(): string | undefined {
		if (!this.isInitialized()) return undefined;
		const row = this.database.prepare('SELECT node FROM adapter_runner WHERE slot = 1').get() as
			| { node: string }
			| undefined;
		return row?.node;
	}

	list(runner: string) {
		if (!this.isInitialized()) return [];
		const rows = this.database
			.prepare(
				'SELECT id, config, enabled_at, cursor, paused, last_run, last_error FROM adapter_sources WHERE removed = 0 ORDER BY id'
			)
			.all() as TrackerAdapterListRow[];
		return rows.map(({ id, config, paused, ...state }) => ({
			...readSourceConfig(config),
			...state,
			id,
			runner,
			paused: Boolean(paused)
		}));
	}

	dueSourceIds(now: number): string[] {
		const rows = this.database
			.prepare(
				'SELECT id FROM adapter_sources WHERE removed = 0 AND paused = 0 AND (last_run IS NULL OR last_run <= ?) ORDER BY id'
			)
			.all(now - 60_000) as { id: string }[];
		return rows.map(({ id }) => id);
	}

	source(id: string): TrackerStoredAdapterSource | undefined {
		const row = this.database
			.prepare(
				'SELECT config, enabled_at, cursor, paused FROM adapter_sources WHERE id = ? AND removed = 0'
			)
			.get(id) as TrackerAdapterSourceRow | undefined;
		if (!row) return undefined;
		const config = readSourceConfig(row.config);
		if (!isTrackerAdapterSourceId(id) || id !== `${config.type}:${config.target}`)
			throw new TypeError('Invalid Tracker adapter source');
		return {
			...config,
			id,
			enabled_at: row.enabled_at,
			cursor: row.cursor,
			paused: Boolean(row.paused)
		};
	}

	/** Save a new source, or revive a removed one; its links and receipts prevent duplicates. */
	add(source: TrackerStoredAdapterSource): boolean {
		// Cursor and pause state live in their own columns, as in legacy rows.
		const config = JSON.stringify({ ...source, cursor: undefined, paused: undefined });
		const { enabled_at } = source;
		const saved = this.database
			.prepare(
				`INSERT INTO adapter_sources(id, config, enabled_at, cursor) VALUES (?, ?, ?, ?)
				ON CONFLICT(id) DO UPDATE SET config = excluded.config, enabled_at = excluded.enabled_at,
				cursor = excluded.cursor, paused = 0, removed = 0, last_run = NULL, last_error = NULL
				WHERE adapter_sources.removed = 1`
			)
			.run(source.id, config, enabled_at, enabled_at);
		return Number(saved.changes) > 0;
	}

	/** Pause, resume or soft-remove a live source. False means there is no such source. */
	change(id: string, action: TrackerAdapterSourceAction): boolean {
		const [column, value] = sourceChanges[action];
		const changed = this.database
			.prepare(`UPDATE adapter_sources SET ${column} = ? WHERE id = ? AND removed = 0`)
			.run(value, id);
		return Number(changed.changes) > 0;
	}

	advance(id: string, startedAt: number): void {
		this.database
			.prepare('UPDATE adapter_sources SET cursor = max(cursor, ?) WHERE id = ?')
			.run(startedAt, id);
	}

	recordRun(id: string, now: number, error: string | null): void {
		this.database
			.prepare('UPDATE adapter_sources SET last_run = ?, last_error = ? WHERE id = ?')
			.run(now, error, id);
	}
}

function readSourceConfig(value: string): TrackerStoredAdapterSource {
	try {
		const source: unknown = JSON.parse(value);
		if (!source || typeof source !== 'object') throw new TypeError();
		return source as TrackerStoredAdapterSource;
	} catch {
		throw new TypeError('Invalid Tracker adapter source');
	}
}

/** The accepted persisted identifiers for Tracker adapter commands. */
export function isTrackerAdapterSourceId(id: string): boolean {
	return (
		(/^github:[a-z0-9][a-z0-9-]*\/[a-z0-9_.-]+$/.test(id) && !/\/(?:\.|\.\.)$/.test(id)) ||
		/^gmail:[a-z0-9][a-z0-9-]{0,63}$/.test(id)
	);
}
