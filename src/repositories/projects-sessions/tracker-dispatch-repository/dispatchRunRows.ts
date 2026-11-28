// @harness-uid u_ksy76trvsj
import { createHash } from 'node:crypto';
import type { SqliteDatabase, SqliteValue } from '../../../core/development-tooling/sqliteTypes';
import type {
	TrackerRunReceipt,
	TrackerSessionEvidence
} from '../../../services/agents-providers/TrackerDispatcherService.types';
import { attemptKey } from '../../../services/agents-providers/tracker-dispatcher-service/launchEligibility';
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
export const legacyUnstarted = `r.state = 'queued' AND r.started_at IS NULL AND r.ended_at IS NULL
	AND r.tmux IS NULL AND r.session_name IS NULL AND r.session_id IS NULL
	AND r.watch_pane IS NULL AND r.exit_code IS NULL`;

export function assertLegacyDispatchRollbackSafe(database: SqliteDatabase): void {
	const blocker = database
		.prepare(
			`SELECT r.id, r.state FROM runs r
		JOIN meta m ON m.k = '${reservationPrefix}' || r.id
		WHERE r.state IN ('queued','running','verifying')
		OR (r.outcome = 'blocked' AND r.session_id IS NOT NULL)
		ORDER BY r.id LIMIT 1`
		)
		.get() as { id: number; state: string } | undefined;
	if (blocker)
		throw new DOMException(
			`Tracker rollback blocked by run ${blocker.id} (${blocker.state})`,
			'InvalidStateError'
		);
}

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

export function legacyDispatchRuns(database: SqliteDatabase, node: string, cutoff: number) {
	return localRows(
		database,
		`WHERE m.k IS NULL AND r.auto_token IS NOT NULL
		AND r.cli IN ('codex','claude')
		AND ((r.state IN ('running','verifying') AND r.tmux IS NOT NULL AND r.started_at IS NOT NULL)
			OR (${legacyUnstarted} AND r.queued_at <= ?))`,
		cutoff
	).map((row) => receipt(row, node));
}

export function adoptLegacyDispatchRun(
	store: TrackerPersistenceService,
	run: TrackerRunReceipt,
	session: TrackerSessionEvidence
): void {
	store.commitLocal(() => {
		const row = localRows(store.database, 'WHERE r.id = ? AND m.k IS NULL', run.id)[0];
		if (
			row &&
			row.tmux === run.tmux &&
			signature(row) === signature(run) &&
			validLegacySession(run, session)
		) {
			writeReservation(store, { ...run, revision: 0, host_session_id: session.id });
		}
		return { result: undefined };
	});
}

function validLegacySession(run: TrackerRunReceipt, session: TrackerSessionEvidence): boolean {
	return (
		(run.state === 'running' || run.state === 'verifying') &&
		run.started_at !== null &&
		session.key === attemptKey(run) &&
		Boolean(session.id) &&
		session.tmux === run.tmux &&
		session.startedAt >= run.started_at - 60_000 &&
		session.startedAt <= run.started_at + 1_000
	);
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
	const fields = { ...row };
	delete fields.reservation;
	const metadata = readReservation(row);
	return {
		...fields,
		node,
		pinned: Boolean(row.pinned),
		launch_source: metadata?.launch_source ?? 'manual',
		dispatch_at: metadata?.dispatch_at,
		manualStartupRetry: metadata?.manualStartupRetry,
		verificationFor: metadata?.verificationFor,
		host_session_id: metadata?.hostSessionId,
		revision: metadata?.revision ?? -1
	};
}

function readReservation(row: TrackerStoredDispatchRun): TrackerRunReservation | undefined {
	if (!row.reservation) return undefined;
	const reservation = JSON.parse(row.reservation) as TrackerRunReservation;
	return reservation.signature === signature(row) ? reservation : undefined;
}

export function persistDispatchRun(
	store: TrackerPersistenceService,
	run: TrackerRunReceipt,
	node: string
): void {
	if (run.node !== node || run.revision < 0)
		throw new DOMException('Cannot write an unowned Tracker attempt', 'InvalidStateError');
	const previous = localRows(store.database, 'WHERE r.id = ?', run.id)[0];
	if (previous) assertRunVersion(receipt(previous, node), run);
	const fields = [...columns, 'tmux', 'source_repo', 'session_name']; // Last three: unsigned.
	const command = previous
		? `UPDATE runs SET ${fields.map((column) => `${column} = ?`).join(', ')} WHERE id = ?`
		: `INSERT INTO runs (${fields.join(', ')}, id) VALUES (${fields.map(() => '?').join(', ')}, ?)`;
	const { tmux = null, source_repo = null, session_name = null } = run;
	store.database.prepare(command).run(...values(run), tmux, source_repo, session_name, run.id);
	writeReservation(store, run);
}

function writeReservation(store: TrackerPersistenceService, run: TrackerRunReceipt): void {
	const { revision, launch_source, dispatch_at, verificationFor } = run;
	const metadata = {
		revision,
		launch_source,
		dispatch_at,
		manualStartupRetry: run.manualStartupRetry,
		verificationFor,
		hostSessionId: run.host_session_id,
		signature: signature(run)
	};
	store.writeMeta({ [reservationPrefix + run.id]: JSON.stringify(metadata) });
}

function assertRunVersion(version: TrackerRunReceipt, run: TrackerRunReceipt) {
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
