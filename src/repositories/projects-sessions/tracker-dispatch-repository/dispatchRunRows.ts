// @harness-uid u_ksy76trvsj
import { createHash } from 'node:crypto';
import type { SqliteDatabase, SqliteValue } from '../../../core/development-tooling/sqliteTypes';
import type { TrackerRunReceipt } from '../../../services/agents-providers/TrackerDispatcherService.types';
import type { TrackerPersistenceService } from '../../../services/projects-sessions/TrackerPersistenceService';
import type {
	TrackerRunReservation,
	TrackerStoredDispatchRun
} from '../TrackerDispatchRepository.types';

const columns = [
	'item_id',
	'auto_token',
	'attempt',
	'rung',
	'cli',
	'model',
	'effort',
	'pinned',
	'kind',
	'project',
	'reason',
	'state',
	'outcome',
	'failure_reason',
	'queued_at',
	'started_at',
	'ended_at',
	'resumed_at',
	'eta_at',
	'kill_at',
	'session_id',
	'exit_code',
	'escalated_from',
	'redone_by',
	'input_tokens',
	'output_tokens',
	'cache_read_tokens',
	'cache_write_tokens',
	'cost_usd',
	'credits_balance'
] as const;
const reservationPrefix = 'harness_dispatch_run:';

export function dispatchRunRows(
	database: SqliteDatabase,
	node: string,
	itemId: string
): TrackerRunReceipt[] {
	const local = localRows(database, 'WHERE r.item_id = ? AND r.auto_token IS NOT NULL', itemId);
	const remote = database
		.prepare('SELECT * FROM remote_runs WHERE item_id = ? AND auto_token IS NOT NULL')
		.all(itemId) as TrackerStoredDispatchRun[];
	return [
		...local.map((row) => receipt(row, node)),
		...remote.map((row) => receipt(row, row.node))
	];
}

export function managedDispatchRuns(database: SqliteDatabase, node: string): TrackerRunReceipt[] {
	return localRows(
		database,
		"WHERE (r.state IN ('queued','running','verifying') OR r.outcome = 'blocked') AND m.v IS NOT NULL"
	)
		.map((row) => receipt(row, node))
		.filter((row) => row.revision >= 0);
}

function localRows(database: SqliteDatabase, where: string, ...bindings: SqliteValue[]) {
	return database
		.prepare(
			`SELECT r.*, m.v AS reservation FROM runs r
		LEFT JOIN meta m ON m.k = '${reservationPrefix}' || r.id ${where} ORDER BY r.id`
		)
		.all(...bindings) as TrackerStoredDispatchRun[];
}

function receipt(row: TrackerStoredDispatchRun, node: string): TrackerRunReceipt {
	const reservation = row.reservation
		? (JSON.parse(row.reservation) as TrackerRunReservation)
		: undefined;
	const metadata = reservation?.signature === signature(row) ? reservation : undefined;
	const { reservation: _, ...fields } = row;
	return {
		...fields,
		node,
		pinned: Boolean(row.pinned),
		launch_source: metadata?.launch_source ?? 'manual',
		dispatch_at: metadata?.dispatch_at,
		verificationFor: metadata?.verificationFor,
		revision: metadata?.revision ?? -1
	};
}

export function persistDispatchRun(
	store: TrackerPersistenceService,
	run: TrackerRunReceipt,
	node: string
): void {
	if (run.node !== node || run.revision < 0)
		throw new DOMException('Cannot write an unowned Tracker attempt', 'InvalidStateError');
	const previous = localRows(store.database, 'WHERE r.id = ?', run.id)[0];
	if (previous) assertRunVersion(previous, run, node);
	const command = previous
		? `UPDATE runs SET ${columns.map((column) => `${column} = ?`).join(', ')} WHERE id = ?`
		: `INSERT INTO runs (${columns.join(', ')}, id) VALUES (${columns.map(() => '?').join(', ')}, ?)`;
	store.database.prepare(command).run(...values(run), run.id);
	const { revision, launch_source, dispatch_at, verificationFor } = run;
	const metadata = {
		revision,
		launch_source,
		dispatch_at,
		verificationFor,
		signature: signature(run)
	};
	store.writeMeta({ [reservationPrefix + run.id]: JSON.stringify(metadata) });
}

function assertRunVersion(
	previous: TrackerStoredDispatchRun,
	run: TrackerRunReceipt,
	node: string
) {
	const version = receipt(previous, node);
	if (
		version.revision < 0 ||
		run.revision !== version.revision + 1 ||
		run.item_id !== version.item_id ||
		run.auto_token !== version.auto_token ||
		run.attempt !== version.attempt
	) {
		throw new DOMException('Tracker attempt version changed', 'InvalidStateError');
	}
}

function values(run: TrackerStoredDispatchRun | TrackerRunReceipt): SqliteValue[] {
	return columns.map((column) =>
		column === 'pinned' ? Number(Boolean(run.pinned)) : (run[column] ?? null)
	);
}

function signature(run: TrackerStoredDispatchRun | TrackerRunReceipt): string {
	return createHash('sha256')
		.update(JSON.stringify(values(run)))
		.digest('hex');
}
