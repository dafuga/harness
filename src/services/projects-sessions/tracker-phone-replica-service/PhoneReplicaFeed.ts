// @harness-uid u_st4dufvqxm
import { randomUUID } from 'node:crypto';
import { SqliteAdapter } from '../../../adapters/development-tooling/SqliteAdapter';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import type { FeedRow, ProjectionRow } from './PhoneReplicaFeed.types';
import { phoneReplicaRows } from './phoneReplicaRows';

const schema = `
	CREATE TABLE IF NOT EXISTS phone_tracker_rows (id TEXT PRIMARY KEY, json TEXT NOT NULL);
	CREATE TABLE IF NOT EXISTS phone_tracker_feed (
		seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL, at INTEGER NOT NULL
	);
`;

const journalWindow = 7 * 86_400_000;
const epochKey = 'phone_tracker_projection_v1';

export class PhoneReplicaFeed {
	private readonly sql: SqliteAdapter;
	readonly epoch: string;

	constructor(private readonly store: TrackerPersistenceService) {
		this.sql = new SqliteAdapter(store.database, []);
		store.database.exec(schema);
		this.epoch = store.getMeta(epochKey) ?? randomUUID();
		store.writeMeta({ [epochKey]: this.epoch });
	}

	current(): ProjectionRow[] {
		return this.sql.query<ProjectionRow>('SELECT id, json FROM phone_tracker_rows ORDER BY id');
	}

	refresh(now: number): void {
		this.sql.transaction(() => {
			const { database, node } = this.store;
			const kept = new Map(this.current().map(({ id, json }) => [id, json]));
			const replace = database.prepare(`
				INSERT INTO phone_tracker_rows (id, json) VALUES (?, ?)
				ON CONFLICT(id) DO UPDATE SET json = excluded.json
			`);
			const note = database.prepare('INSERT INTO phone_tracker_feed(id, at) VALUES (?, ?)');
			const rows = phoneReplicaRows(database, node, now);
			const included = new Set(rows.map(({ id }) => id));
			const drop = database.prepare('DELETE FROM phone_tracker_rows WHERE id = ?');
			for (const id of kept.keys()) {
				if (included.has(id)) continue;
				drop.run(id);
				note.run(id, now);
			}
			for (const row of rows) {
				const json = JSON.stringify(row);
				if (json === kept.get(row.id)) continue;
				replace.run(row.id, json);
				note.run(row.id, now);
			}
			this.sql.execute(
				'DELETE FROM phone_tracker_feed WHERE seq <= cast(? AS INTEGER) - 20000 OR at < ?',
				[this.head(), now - journalWindow]
			);
		});
	}

	head(): string {
		const [row] = this.sql.query<{ head: string }>(`
			SELECT coalesce(cast(seq AS TEXT), '0') AS head FROM sqlite_sequence
			WHERE name = 'phone_tracker_feed'
		`);
		return row?.head ?? '0';
	}

	floor(): bigint {
		const [row] = this.sql.query<{ first: string | null }>(
			'SELECT cast(min(seq) AS TEXT) AS first FROM phone_tracker_feed'
		);
		return row.first === null ? BigInt(this.head()) : BigInt(row.first) - 1n;
	}

	after(sequence: string): FeedRow[] {
		return this.sql.query<FeedRow>(
			`
			SELECT cast(feed.seq AS TEXT) AS seq, feed.id, rows.json
			FROM phone_tracker_feed AS feed LEFT JOIN phone_tracker_rows AS rows ON rows.id = feed.id
			WHERE feed.seq > cast(? AS INTEGER) ORDER BY feed.seq LIMIT 101
		`,
			[sequence]
		);
	}
}
