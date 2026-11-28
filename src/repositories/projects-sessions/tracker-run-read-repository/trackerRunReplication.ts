// @harness-uid u_lahmutfc24
import type { SqliteDatabase, SqliteValue } from '../../../core/development-tooling/sqliteTypes';

import type {
	TrackerWireObject,
	TrackerWireValue
} from '../../../services/projects-sessions/TrackerHubSyncService.types';

const columns = [
	'item_id',
	'attempt',
	'rung',
	'cli',
	'model',
	'effort',
	'pinned',
	'kind',
	'project',
	'state',
	'outcome',
	'failure_reason',
	'queued_at',
	'started_at',
	'ended_at',
	'redone_by',
	'input_tokens',
	'output_tokens',
	'cache_read_tokens',
	'cache_write_tokens',
	'cost_usd',
	'idle_nudges',
	'auto_token',
	'tmux',
	'session_name',
	'session_id',
	'escalated_from',
	'credits_balance',
	'resumed_at',
	'task_type'
] as const;
const projection = columns.join(', ');

export function localTrackerRunHistory(db: SqliteDatabase, limit: number): TrackerWireObject[] {
	return db
		.prepare(
			`SELECT id, ${projection} FROM runs
		WHERE state IN ('finished','queued','running','verifying','observed') ORDER BY id DESC LIMIT ?`
		)
		.all(limit) as TrackerWireObject[];
}

export function relayedTrackerRunHistory(db: SqliteDatabase, peer: string): unknown[] {
	return db
		.prepare(
			`SELECT node, id, ${projection} FROM remote_runs WHERE node <> ?
		ORDER BY coalesce(resumed_at, started_at, queued_at, 0) DESC, node, id DESC LIMIT 3000`
		)
		.all(peer);
}

// An older computer reports no task type, which must not erase one already recorded.
function mergedColumn(column: (typeof columns)[number]) {
	if (column === 'idle_nudges')
		return 'idle_nudges = max(remote_runs.idle_nudges, excluded.idle_nudges)';
	if (column === 'task_type')
		return 'task_type = coalesce(excluded.task_type, remote_runs.task_type)';
	return `${column} = excluded.${column}`;
}

export function importTrackerRunHistory(
	db: SqliteDatabase,
	rows: readonly TrackerWireValue[],
	nodeFor: (row: TrackerWireObject) => string | undefined
): void {
	const record = db.prepare(`INSERT INTO remote_runs (node, id, ${projection})
		VALUES (${Array(columns.length + 2)
			.fill('?')
			.join(', ')}) ON CONFLICT(node, id) DO UPDATE SET
		${columns.map(mergedColumn).join(', ')}
		WHERE coalesce(excluded.resumed_at, 0) > coalesce(remote_runs.resumed_at, 0)
		OR (coalesce(excluded.resumed_at, 0) = coalesce(remote_runs.resumed_at, 0)
		AND (remote_runs.ended_at IS NULL OR excluded.ended_at >= remote_runs.ended_at)
		AND (remote_runs.started_at IS NULL OR excluded.started_at IS NOT NULL)
		AND (remote_runs.state != 'verifying' OR excluded.state IN ('finished','verifying')))`);
	for (const row of rows) {
		if (!isRunRecord(row) || !Number.isSafeInteger(row.id) || Number(row.id) < 1) continue;
		const source = nodeFor(row);
		if (!source || /\s/.test(source)) continue;
		const values = columns.map((column) => legacyRunValue(column, row[column]));
		record.run(source, Number(row.id), ...values);
	}
}

function isRunRecord(value: TrackerWireValue): value is TrackerWireObject {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
	const row = value as TrackerWireObject;
	return (
		typeof row.item_id === 'string' &&
		typeof row.state === 'string' &&
		['finished', 'queued', 'running', 'verifying', 'observed'].includes(row.state)
	);
}

function legacyRunValue(column: (typeof columns)[number], value: unknown): SqliteValue {
	if (column === 'idle_nudges' || column === 'pinned') return Number(value) || 0;
	return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))
		? value
		: null;
}
