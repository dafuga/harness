// @harness-uid u_7qdlzcw2vs
import type { RingRow } from './SyncRing.types';
import { numbered, syncLimits } from './syncWire';

/**
 * The last few sealed frames of the account, so a viewer that reconnects can catch up. It holds
 * ciphertext only, is trimmed on every write and expires with the clock.
 */
export class SyncRing {
	constructor(private readonly sql: SqlStorage) {
		sql.exec(
			`CREATE TABLE IF NOT EXISTS ring (
				n INTEGER PRIMARY KEY AUTOINCREMENT,
				scope TEXT NOT NULL,
				at INTEGER NOT NULL,
				frame BLOB NOT NULL
			)`
		);
	}

	/** Keeps a frame and returns its number. */
	push(scope: string, frame: Uint8Array, now: number): number {
		const row = this.sql
			.exec<{
				n: number;
			}>('INSERT INTO ring (scope, at, frame) VALUES (?, ?, ?) RETURNING n', scope, now, frame)
			.one();
		this.sql.exec(
			'DELETE FROM ring WHERE n <= ? OR at < ?',
			row.n - syncLimits.ringFrames,
			now - syncLimits.ringMs
		);
		return row.n;
	}

	/** Frames after `after` for these scopes, numbered, oldest first. */
	since(after: number, scopes: ReadonlySet<string>, now: number): Uint8Array[] {
		const rows = this.sql
			.exec<RingRow>(
				'SELECT n, scope, frame FROM ring WHERE n > ? AND at >= ? ORDER BY n',
				after,
				now - syncLimits.ringMs
			)
			.toArray();
		return rows
			.filter((row) => scopes.has(row.scope))
			.map((row) => numbered(row.n, new Uint8Array(row.frame)));
	}

	/** The number the next viewer should resume from. */
	head(): number {
		const row = this.sql.exec<{ n: number | null }>('SELECT MAX(n) AS n FROM ring').one();
		return row.n ?? 0;
	}
}
