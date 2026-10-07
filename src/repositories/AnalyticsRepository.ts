import type { Database } from 'bun:sqlite';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import { mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import type { AnalyticsEvent } from '../core/analyticsTypes';

export class AnalyticsRepository {
	private readonly db: Database;
	constructor(home = process.env.HARNESS_ANALYTICS_HOME ?? join(homedir(), '.codex', 'harness')) {
		mkdirSync(home, { recursive: true, mode: 0o700 });
		const path = join(home, 'analytics.sqlite');
		const { Database: Sqlite } = require('bun:sqlite') as { Database: typeof Database };
		this.db = new Sqlite(path, { create: true });
		chmodSync(path, 0o600);
		this.db.exec('PRAGMA busy_timeout=5000;');
		this.initialize();
		this.db.exec(
			'CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, timestamp TEXT NOT NULL, data TEXT NOT NULL); PRAGMA user_version=1;'
		);
	}
	private initialize(): void {
		const version = this.db.query('PRAGMA user_version').get() as { user_version: number };
		if (version.user_version > 1) throw new Error('Unsupported analytics schema version.');
		for (let attempt = 0; attempt < 100; attempt++) {
			try {
				this.db.exec('PRAGMA journal_mode=WAL;');
				return;
			} catch (error) {
				if (attempt === 99) throw error;
				Bun.sleepSync(25);
			}
		}
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
	close(): void {
		this.db.close();
	}
}
