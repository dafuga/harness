// @harness-uid u_ksy76trvsj
import type { SqliteDatabase } from '../../../core/development-tooling/sqliteTypes';
import type {
	TrackerDispatchSnapshot,
	TrackerDispatchWrites,
	TrackerRunReceipt
} from '../../../services/agents-providers/TrackerDispatcherService.types';
import type {
	EventDetail,
	TrackerLaunchEvent,
	TrackerLaunchEventRow
} from './dispatchLaunchEvents.types';

const failures: readonly (string | null)[] = ['failed', 'rejected', 'timed_out'];

/** Record what a dispatch decision changed, inside the transaction that commits it. */
export function recordLaunchEvents(
	database: SqliteDatabase,
	{ snapshot, writes }: { snapshot: TrackerDispatchSnapshot; writes?: TrackerDispatchWrites },
	at: number
): void {
	const insert = database.prepare(
		'INSERT INTO launch_events(at, kind, item_id, run_id, text) VALUES(?, ?, ?, ?, ?)'
	);
	for (const event of launchEvents(snapshot, writes))
		insert.run(at, event.kind, event.itemId, event.runId, event.text);
}

export function pendingLaunchEvents(database: SqliteDatabase) {
	return database
		.prepare('SELECT * FROM launch_events WHERE batched = 0 ORDER BY id')
		.all() as unknown as TrackerLaunchEventRow[];
}

export function markLaunchEventsBatched(database: SqliteDatabase, lastId: number): void {
	database
		.prepare('UPDATE launch_events SET batched = 1 WHERE batched = 0 AND id <= ?')
		.run(lastId);
}

function launchEvents(
	snapshot: TrackerDispatchSnapshot,
	writes: TrackerDispatchWrites = {}
): TrackerLaunchEvent[] {
	return (writes.runs ?? []).flatMap((run) =>
		runEvents(run, snapshot, writes).map(([kind, detail]) => ({
			kind,
			itemId: run.item_id,
			runId: run.id,
			text: `[${run.item_id.slice(0, 6)}] ${snapshot.item?.title ?? ''}: ${detail}`
		}))
	);
}

function runEvents(
	run: TrackerRunReceipt,
	snapshot: TrackerDispatchSnapshot,
	writes: TrackerDispatchWrites
): EventDetail[] {
	const previous = snapshot.runs.find(({ node, id }) => node === run.node && id === run.id);
	if (!previous && run.cli === 'none') return [['launch_failed', String(run.failure_reason)]];
	if (!previous && run.escalated_from != null)
		return [['escalated', retryDetail(run, writes.runs ?? [])]];
	const changed = run.outcome && run.outcome !== previous?.outcome;
	return [...startEvents(run, previous), ...(changed ? outcomeEvents(run, snapshot, writes) : [])];
}

function startEvents(run: TrackerRunReceipt, previous?: TrackerRunReceipt): EventDetail[] {
	return run.started_at && !previous?.started_at ? [['launched', startDetail(run)]] : [];
}

function outcomeEvents(
	run: TrackerRunReceipt,
	snapshot: TrackerDispatchSnapshot,
	{ item, failedRunId }: TrackerDispatchWrites
): EventDetail[] {
	if (run.outcome === 'done') return [['done', `done on ${run.rung}`]];
	if (run.outcome === 'blocked')
		return [['blocked', `${run.rung} session blocked on Daniel: ${run.failure_reason}`]];
	if (!failures.includes(run.outcome) && failedRunId !== run.id) return [];
	const failed: EventDetail = ['failed', `${run.rung} ${outcomeName(run)}: ${run.failure_reason}`];
	if (!item?.blockedReason?.startsWith('auto-launch gave up')) return [failed];
	const history = snapshot.runs
		.filter((attempt) => attempt.auto_token === run.auto_token && attempt.id !== run.id)
		.concat(run)
		.map((attempt) => `${attempt.rung}: ${attempt.outcome}`);
	return [failed, ['gave_up', `gave up after ${history.join(', ')}`]];
}

function startDetail(run: TrackerRunReceipt) {
	const model = [run.model, run.effort].filter(Boolean).join(' ');
	const retry = run.escalated_from ? `, retry ${run.attempt} after run ${run.escalated_from}` : '';
	return `launched on ${run.rung} (${model})${retry}${run.tmux ? `; tmux ${run.tmux}` : ''}`;
}

function retryDetail(retry: TrackerRunReceipt, runs: readonly TrackerRunReceipt[]) {
	const failed = runs.find(({ id }) => id === retry.escalated_from);
	const after = failed ? ` after ${failed.rung} ${outcomeName(failed)}` : '';
	return `retrying on ${retry.rung} (${retry.model})${after}`;
}

function outcomeName({ outcome }: TrackerRunReceipt) {
	return String(outcome).replace('_', ' ');
}
