// @harness-uid u_ksy76trvsj
import type {
	TrackerDispatchSnapshot,
	TrackerRunReceipt
} from '../../../services/agents-providers/TrackerDispatcherService.types';
import type { TrackerPersistenceService } from '../../../services/projects-sessions/TrackerPersistenceService';
import {
	canonicalNode,
	minute
} from '../../../services/agents-providers/tracker-dispatcher-service/launchEligibility';
import { finishRun } from '../../../services/agents-providers/tracker-dispatcher-service/runReceipt';
import { trackerItemError } from '../../../utils/projects-sessions/trackerItemError';
import { TrackerItemReadRepository } from '../TrackerItemReadRepository';
import { canBlockStoppedRun } from './dispatchItemFields';
import { managedDispatchRuns, persistDispatchRun } from './dispatchRunRows';

const automaticStartsKey = 'harness_automatic_launch_slots';

export function trackerDispatchControl(
	store: TrackerPersistenceService,
	node: string,
	snapshot: (id: string) => TrackerDispatchSnapshot,
	now: () => number
) {
	return {
		reserveAutomaticSlot(at: number) {
			return store.commitLocal(() => {
				const history = JSON.parse(store.getMeta(automaticStartsKey) ?? '[]') as number[];
				const recent = history.filter((entry) => at - entry < minute);
				if (recent.length >= 2) return { result: false };
				store.writeMeta({ [automaticStartsKey]: JSON.stringify([...recent, at]) });
				return { result: true };
			});
		},
		reassignAdapterLaunch(id: string, token: string, target: string) {
			return store.commitLocal(() => {
				if (!canDelegate(snapshot(id), node, token)) return { result: false };
				return {
					result: true,
					operation: {
						itemId: id,
						fields: {
							computer: target,
							launch_target: target,
							'note+': `Tester intake moved to ${target} because ${node} is at session capacity`
						}
					}
				};
			});
		},
		...trackerStopControl(store, node, snapshot, now)
	};
}

/** Finish this computer's queued runs that no host was ever asked to start. */
export function cancelQueuedDispatchRuns(
	store: TrackerPersistenceService,
	itemId: string,
	now: number
) {
	if (!store.database.prepare("SELECT 1 FROM sqlite_schema WHERE name = 'runs'").get()) return;
	const node = canonicalNode(store.node, {});
	for (const run of managedDispatchRuns(store.database, node)) {
		if (run.item_id !== itemId || run.revision < 0 || !neverDispatched(run)) continue;
		const reason = 'launch cancelled before startup';
		persistDispatchRun(store, finishRun(run, { outcome: 'abandoned', reason, now }), node);
	}
}

function neverDispatched({ state, dispatch_at, started_at }: TrackerRunReceipt) {
	return state === 'queued' && dispatch_at === undefined && started_at === null;
}

function trackerStopControl(
	store: TrackerPersistenceService,
	node: string,
	snapshot: (id: string) => TrackerDispatchSnapshot,
	now: () => number
) {
	return {
		stopTarget(reference: string) {
			const items = new TrackerItemReadRepository(store.database);
			const runId = localRunId(reference);
			const itemId = stopItemId(store, items, { reference, runId });
			const item = items.getStored(itemId);
			const run = selectStopRun(snapshot(itemId).runs, { node, runId, token: item.auto });
			guardStopTarget(store, itemId, run);
			store.appendLocal({
				itemId,
				fields: {
					schedule_off: 1,
					auto: null,
					launch_target: null,
					launch_source: null,
					launch_pick: null,
					'note+': run
						? `stop requested for run #${run.id}; automatic launch turned off`
						: 'launch stopped; automatic launch turned off'
				}
			});
			return { item: items.getStored(itemId), run };
		},
		finishStoppedRun(run: TrackerRunReceipt) {
			return finishStoppedDispatch(store, () => snapshot(run.item_id), run, { node, now });
		}
	};
}

function finishStoppedDispatch(
	store: TrackerPersistenceService,
	read: () => TrackerDispatchSnapshot,
	run: TrackerRunReceipt,
	{ node, now }: { node: string; now: () => number }
) {
	store.commitLocal(() => {
		const snapshot = read();
		const current = snapshot.runs.find(
			(entry) => entry.id === run.id && entry.node === node && entry.revision === run.revision
		);
		if (!current || current.revision < 0 || !stoppable(current)) return { result: undefined };
		const reason = 'stopped by operator';
		persistDispatchRun(
			store,
			finishRun(current, { outcome: 'abandoned', reason, now: now() }),
			node
		);
		const operation = canBlockStoppedRun(snapshot, current)
			? { itemId: run.item_id, fields: { status: 'blocked', blocked_reason: reason } }
			: undefined;
		return { result: undefined, operation };
	});
}

function canDelegate({ item, runs }: TrackerDispatchSnapshot, node: string, token: string) {
	if (!item?.adapterDueOwner || canonicalNode(item.adapterDueOwner, {}) !== node) return false;
	const intent = item.launch;
	return (
		intent?.token === token &&
		intent.source === 'due' &&
		intent.target !== null &&
		canonicalNode(intent.target, {}) === node &&
		!runs.some((run) => run.auto_token === token)
	);
}

function localRunId(reference: string): number | null {
	const match = /^#([1-9][0-9]*)$/.exec(reference) ?? /^([1-9][0-9]{0,4})$/.exec(reference);
	if (!match) return null;
	const id = Number(match[1]);
	if (!Number.isSafeInteger(id)) throw trackerItemError('invalid run number');
	return id;
}

function stopItemId(
	store: TrackerPersistenceService,
	items: TrackerItemReadRepository,
	{ reference, runId }: { reference: string; runId: number | null }
) {
	if (runId === null) return items.resolve(reference).id;
	const row = store.database.prepare('SELECT item_id FROM runs WHERE id = ?').get(runId) as
		| { item_id: string }
		| undefined;
	if (!row) throw trackerItemError('no local Tracker run with that number', 404);
	return row.item_id;
}

function stoppable(run: TrackerRunReceipt) {
	return run.state !== 'finished' || run.outcome === 'blocked';
}

function selectStopRun(
	runs: readonly TrackerRunReceipt[],
	{ node, runId, token }: { node: string; runId: number | null; token: string | null }
) {
	if (runs.some((run) => run.node !== node && run.state !== 'finished'))
		throw trackerItemError('stop this run on its owning computer', 409);
	const local = runs.filter((run) => run.node === node);
	if (runId === null) return local.filter(stoppable).at(-1);
	const run = local.find((entry) => entry.id === runId);
	if (!run) throw trackerItemError('run is not a managed Tracker attempt', 409);
	if (
		(token && token !== run.auto_token) ||
		local.some((entry) => entry.id !== runId && entry.state !== 'finished')
	)
		throw trackerItemError('run was superseded; stop the current run by item', 409);
	return run;
}

function guardStopTarget(
	store: TrackerPersistenceService,
	itemId: string,
	run?: TrackerRunReceipt
) {
	if (run && run.revision < 0 && run.state !== 'finished')
		throw trackerItemError('run is awaiting adoption by the local Tracker runner', 409);
	if (
		!run &&
		store.database
			.prepare("SELECT 1 FROM runs WHERE item_id = ? AND state = 'observed' LIMIT 1")
			.get(itemId)
	)
		throw trackerItemError('this hand-launched session is outside the managed runner', 409);
	if (
		run &&
		store.database
			.prepare(
				`SELECT 1 FROM meta m JOIN items i ON i.id = m.v
		WHERE m.k GLOB ? AND i.id <> ? AND i.deleted = 0 AND i.status IN ('open', 'in_progress', 'blocked') LIMIT 1`
			)
			.get(`harness_tracker_session_item:${run.id}:*`, itemId)
	)
		throw trackerItemError('this session is linked to another active Tracker item', 409);
}
