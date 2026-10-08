import type { Database } from 'bun:sqlite';
import { createRequire } from 'node:module';
import { mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import type { SwitchRequest, SwitchStore } from '../core/pickerTypes';
import { switchRevision } from '../core/pickerTypes';

const require = createRequire(import.meta.url);

export class ProviderSwitchRepository implements SwitchStore {
	private readonly db: Database;
	constructor(home: string) {
		mkdirSync(home, { recursive: true, mode: 0o700 });
		const path = join(home, 'provider-switches.sqlite');
		const { Database: Sqlite } = require('bun:sqlite') as { Database: typeof Database };
		this.db = new Sqlite(path, { create: true });
		chmodSync(path, 0o600);
		this.db.exec(
			'PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS switches (session TEXT PRIMARY KEY, id TEXT NOT NULL, data TEXT NOT NULL);'
		);
	}

	get(sessionId: string): SwitchRequest | null {
		const row = this.db.query('SELECT data FROM switches WHERE session=?').get(sessionId) as {
			data: string;
		} | null;
		return row ? (JSON.parse(row.data) as SwitchRequest) : null;
	}

	put(record: SwitchRequest, expectedId: string | null): boolean {
		return (
			this.db
				.query(
					'INSERT INTO switches VALUES (?, ?, ?) ON CONFLICT(session) DO UPDATE SET id=excluded.id, data=excluded.data WHERE switches.id=?'
				)
				.run(record.sessionId, switchRevision(record), JSON.stringify(record), expectedId)
				.changes === 1
		);
	}

	list(): SwitchRequest[] {
		const rows = this.db.query('SELECT data FROM switches ORDER BY rowid DESC LIMIT 100').all() as {
			data: string;
		}[];
		return rows.map((row) => JSON.parse(row.data) as SwitchRequest);
	}

	close(): void {
		this.db.close();
	}
}
