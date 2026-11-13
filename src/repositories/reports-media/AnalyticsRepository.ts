// @harness-uid u_4oijppigay
import type { Database } from 'bun:sqlite';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import { mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import type { AnalyticsEvent } from '../../core/reports-media/analyticsTypes';
import { AnalyticsEvent as AnalyticsEventModel } from '../../models/reports-media/AnalyticsEvent';
import { sqliteTableSql } from '../../utils/development-tooling/sqliteTableSql';

export class AnalyticsRepository {
	private readonly db: Database;
	constructor(
		home = process.env.HARNESS_ANALYTICS_HOME ?? join(homedir(), '.codex', 'harness'),
		options: { initialization?: 'synchronous' | 'deferred' } = {}
	) {
		mkdirSync(home, { recursive: true, mode: 0o700 });
		const path = join(home, 'analytics.sqlite');
		const { Database: Sqlite } = require('bun:sqlite') as { Database: typeof Database };
		this.db = new Sqlite(path, { create: true });
		try {
			chmodSync(path, 0o600);
			this.db.exec('PRAGMA busy_timeout=5000;');
			if (options.initialization !== 'deferred') this.initialize();
		} catch (error) {
			try {
				this.db.close();
			} catch {
				// Preserve the initialization error.
			}
			throw error;
		}
	}
	static async open(
		home = process.env.HARNESS_ANALYTICS_HOME ?? join(homedir(), '.codex', 'harness')
	): Promise<AnalyticsRepository> {
		const repository = new AnalyticsRepository(home, { initialization: 'deferred' });
		try {
			repository.db.exec('PRAGMA busy_timeout=0;');
			await initializeAsync(repository.db);
			repository.db.exec('PRAGMA busy_timeout=5000;');
			return repository;
		} catch (error) {
			try {
				repository.close();
			} catch {
				// Keep the initialization failure as the reported cause.
			}
			throw error;
		}
	}
	private initialize(): void {
		initializeSync(this.db);
	}
	async reconcileHistorical(root: string, project: string): Promise<void> {
		const previous = await realpath(root);
		if (previous !== project)
			this.db
				.query(
					"DELETE FROM events WHERE json_extract(data, '$.project')=? AND json_extract(data, '$.historical')=1"
				)
				.run(previous);
	}
	record(event: AnalyticsEvent): void {
		this.db
			.query('INSERT OR IGNORE INTO events VALUES (?, ?, ?)')
			.run(event.id, event.timestamp, JSON.stringify(event));
	}
	recordImported(event: AnalyticsEvent): void {
		const previous = this.db.query('SELECT data FROM events WHERE id=?').get(event.id) as {
			data: string;
		} | null;
		if (previous && !(JSON.parse(previous.data) as AnalyticsEvent).historical)
			event.historical = false;
		this.db
			.query('INSERT INTO events VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data')
			.run(event.id, event.timestamp, JSON.stringify(event));
	}
	events(): AnalyticsEvent[] {
		const rows = this.db.query('SELECT data FROM events ORDER BY timestamp, rowid').all() as {
			data: string;
		}[];
		return rows.map((row) => JSON.parse(row.data) as AnalyticsEvent);
	}
	/** Preview retention by default. Unknown timestamps remain untouched. */
	prune(
		before: string,
		apply = false
	): { before: string; matching: number; deleted: number; dryRun: boolean } {
		const date = new Date(before);
		if (
			!Number.isFinite(date.getTime()) ||
			!before.endsWith('Z') ||
			date.toISOString().slice(0, 19) !== before.slice(0, 19) ||
			date.getTime() >= Date.now()
		)
			throw new Error('Retention cutoff must be an ISO UTC timestamp in the past.');
		const cutoff = date.toISOString();
		return this.db.transaction(() => {
			const { count } = this.db
				.query('SELECT COUNT(*) AS count FROM events WHERE julianday(timestamp) < julianday(?)')
				.get(cutoff) as { count: number };
			const deleted = apply
				? this.db.query('DELETE FROM events WHERE julianday(timestamp) < julianday(?)').run(cutoff)
						.changes
				: 0;
			return { before: cutoff, matching: count, deleted, dryRun: !apply };
		})();
	}

	close(): void {
		this.db.close();
	}
}

function initializeSync(db: Database): void {
	assertSupportedVersion(db);
	for (let attempt = 0; attempt < 100; attempt++) {
		try {
			db.exec('PRAGMA journal_mode=WAL;');
			break;
		} catch (error) {
			if (attempt === 99) throw error;
			Bun.sleepSync(25);
		}
	}
	initializeTables(db);
}

async function initializeAsync(db: Database): Promise<void> {
	const deadline = performance.now() + 5000;
	let attempt = 0;
	while (true) {
		try {
			assertSupportedVersion(db);
			db.exec('PRAGMA journal_mode=WAL;');
			initializeTables(db);
			return;
		} catch (error) {
			if (!isSqliteBusy(error)) throw error;
			const remaining = deadline - performance.now();
			if (remaining <= 0) {
				const timeout = new Error('Timed out waiting to initialize the analytics database.');
				(timeout as Error & { cause?: unknown }).cause = error;
				throw timeout;
			}
			const backoff = Math.min(100, 8 * 2 ** Math.min(attempt, 4));
			const delay = Math.min(remaining, backoff / 2 + Math.random() * (backoff / 2));
			await Bun.sleep(delay);
			attempt += 1;
		}
	}
}

function assertSupportedVersion(db: Database): void {
	const version = db.query('PRAGMA user_version').get() as { user_version: number };
	if (version.user_version > 1) throw new Error('Unsupported analytics schema version.');
}

function initializeTables(db: Database): void {
	db.exec(`${sqliteTableSql(AnalyticsEventModel.definition)}; PRAGMA user_version=1;`);
	db.exec(
		"CREATE INDEX IF NOT EXISTS events_project ON events(json_extract(data, '$.project')); CREATE INDEX IF NOT EXISTS events_recorded_at ON events(julianday(timestamp));"
	);
}

function isSqliteBusy(error: unknown): boolean {
	return (
		typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		typeof error.code === 'string' &&
		/^SQLITE_(?:BUSY|LOCKED)(?:_|$)/.test(error.code)
	);
}
