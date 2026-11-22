// @harness-uid u_vglplkno45
import type { SqliteDatabase } from '../../core/development-tooling/sqliteTypes';
import type {
	TrackerAdapterListRow,
	TrackerAdapterSource,
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

	source(id: string): TrackerAdapterSource | undefined {
		const row = this.database
			.prepare(
				'SELECT config, enabled_at, cursor, paused FROM adapter_sources WHERE id = ? AND removed = 0'
			)
			.get(id) as TrackerAdapterSourceRow | undefined;
		if (!row) return undefined;
		const config = readSourceConfig(row.config);
		if (
			config.type !== 'github' ||
			id !== `github:${config.target}` ||
			!/^[a-z0-9][a-z0-9-]*\/[a-z0-9_.-]+$/.test(config.target) ||
			/\/(?:\.|\.\.)$/.test(config.target)
		)
			throw new TypeError('Invalid Tracker adapter source');
		return {
			...config,
			id,
			enabled_at: row.enabled_at,
			cursor: row.cursor,
			paused: Boolean(row.paused)
		};
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

function readSourceConfig(value: string): TrackerAdapterSource {
	try {
		const source: unknown = JSON.parse(value);
		if (!source || typeof source !== 'object') throw new TypeError();
		return source as TrackerAdapterSource;
	} catch {
		throw new TypeError('Invalid Tracker adapter source');
	}
}
