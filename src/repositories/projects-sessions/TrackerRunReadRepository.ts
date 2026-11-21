// @harness-uid u_lahmutfc24
import type { SqliteDatabase, SqliteValue } from '../../core/development-tooling/sqliteTypes';
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

	list({ itemId, limit }: TrackerRunFilters = {}): TrackerListedRun[] {
		if (itemId) {
			return this.rows('WHERE item_id = ?', itemId).sort(compareQueue);
		}
		const cap = Number(limit) || 50;
		const runs = this.rows('ORDER BY queued_at DESC, id DESC LIMIT ?', cap);
		return runs.sort((left, right) => compareQueue(right, left)).slice(0, cap);
	}

	finished(): TrackerListedRun[] {
		return this.rows("WHERE state = 'finished'");
	}

	private rows(clause: string, ...bindings: SqliteValue[]): TrackerListedRun[] {
		const local = this.select('runs', clause, bindings);
		const remote = this.select('remote_runs', clause, bindings);
		return [...local.map((run) => ({ ...run, node: this.node })), ...remote];
	}

	private select(table: TrackerRunTable, clause: string, bindings: SqliteValue[]) {
		const exists = this.database
			.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?")
			.get(table);
		if (!exists) return [];
		return this.database
			.prepare(`SELECT * FROM ${table} ${clause}`)
			.all(...bindings) as TrackerListedRun[];
	}
}

function compareQueue(left: TrackerListedRun, right: TrackerListedRun): number {
	return (left.queued_at ?? 0) - (right.queued_at ?? 0) || left.id - right.id;
}
