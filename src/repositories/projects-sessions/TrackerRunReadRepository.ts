// @harness-uid u_lahmutfc24
import type { SqliteDatabase, SqliteValue } from '../../core/development-tooling/sqliteTypes';
import type { TrackerWireValue } from '../../services/projects-sessions/TrackerHubSyncService.types';
import { SqliteAdapter } from '../../adapters/development-tooling/SqliteAdapter';
import {
	importTrackerRunHistory,
	localTrackerRunHistory,
	relayedTrackerRunHistory
} from './tracker-run-read-repository/trackerRunReplication';
import type {
	TrackerListedRun,
	TrackerRunFilters,
	TrackerRunTable
} from './TrackerRunReadRepository.types';

/** Reads local and replicated runs using their legacy node and ID identities. */
export class TrackerRunReadRepository {
	constructor(
		private readonly database: SqliteDatabase,
		private readonly node: string
	) {}

	list(filters: TrackerRunFilters = {}): TrackerListedRun[] {
		const { itemId, limit } = filters;
		if (itemId) {
			return this.rows('WHERE item_id = ?', itemId).sort(compareQueue);
		}
		const cap = Number(limit) || 50;
		const runs = this.rows('ORDER BY queued_at DESC, id DESC LIMIT ?', cap);
		return runs.sort((left, right) => compareQueue(right, left)).slice(0, cap);
	}

	launchConsumed(itemId: string, token: string, replaceBlocked = false): boolean {
		const attempts = this.list({ itemId }).filter(({ auto_token }) => auto_token === token);
		return (
			attempts.length > 0 &&
			attempts.every(
				({ state, outcome }) => state === 'finished' && (replaceBlocked || outcome !== 'blocked')
			)
		);
	}

	finished(): TrackerListedRun[] {
		return this.rows("WHERE state = 'finished'");
	}

	latestLocalRunId() {
		return this.select('runs', 'ORDER BY id DESC LIMIT 1', [])[0]?.id;
	}

	activeLocal() {
		return this.select('runs', "WHERE state IN ('queued','running','verifying') ORDER BY id", []);
	}

	pendingEvents(): number | undefined {
		if (!this.hasTable('launch_events')) return undefined;
		const row = this.database
			.prepare('SELECT count(*) AS total FROM launch_events WHERE batched = 0')
			.get() as { total: number };
		return row.total;
	}

	exportLocal() {
		return localTrackerRunHistory(this.database, 5000);
	}

	historyRowsFor(peer: string): readonly unknown[] {
		const local = localTrackerRunHistory(this.database, 3000).map((row) => ({
			...row,
			node: this.node
		}));
		return [...local, ...relayedTrackerRunHistory(this.database, peer)];
	}

	importRemote(peer: string, rows: readonly TrackerWireValue[]): void {
		if (peer === this.node || peer === '?') return;
		new SqliteAdapter(this.database, []).transaction(() =>
			importTrackerRunHistory(this.database, rows, () => peer)
		);
	}

	/** Import a hub or Mac peer reply, which names the node that owns each run. */
	importLinkHistory(rows: readonly TrackerWireValue[]): void {
		new SqliteAdapter(this.database, []).transaction(() =>
			importTrackerRunHistory(this.database, rows, ({ node }) =>
				typeof node === 'string' && node !== this.node ? node : undefined
			)
		);
	}

	private rows(clause: string, ...bindings: SqliteValue[]): TrackerListedRun[] {
		const local = this.select('runs', clause, bindings);
		const remote = this.select('remote_runs', clause, bindings);
		return [...local.map((run) => ({ ...run, node: this.node })), ...remote];
	}

	private select(table: TrackerRunTable, clause: string, bindings: SqliteValue[]) {
		if (!this.hasTable(table)) return [];
		return this.database
			.prepare(`SELECT * FROM ${table} ${clause}`)
			.all(...bindings) as TrackerListedRun[];
	}

	private hasTable(table: TrackerRunTable | 'launch_events'): boolean {
		return Boolean(
			this.database
				.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?")
				.get(table)
		);
	}
}

function compareQueue(left: TrackerListedRun, right: TrackerListedRun): number {
	return (left.queued_at ?? 0) - (right.queued_at ?? 0) || left.id - right.id;
}
