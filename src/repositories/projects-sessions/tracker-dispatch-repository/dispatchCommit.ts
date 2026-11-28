// @harness-uid u_ksy76trvsj
import type {
	TrackerDispatchDecision,
	TrackerDispatchResult,
	TrackerDispatchSnapshot,
	TrackerDispatchWrites
} from '../../../services/agents-providers/TrackerDispatcherService.types';
import type {
	TrackerDispatchCommitRequest,
	TrackerDispatchCommitTarget
} from './dispatchCommit.types';
import { dispatchJournalFields } from './dispatchItemFields';
import { recordLaunchEvents } from './dispatchLaunchEvents';
import { persistDispatchRun } from './dispatchRunRows';

export const dueStartKey = 'due_scheduler_last_grant';

/** Commit one decision's runs, launch events and item change in a single journal transaction. */
export function commitDecision(
	target: TrackerDispatchCommitTarget,
	request: TrackerDispatchCommitRequest,
	decide: (snapshot: TrackerDispatchSnapshot) => TrackerDispatchDecision
): TrackerDispatchResult {
	const { store, now = Date.now } = target;
	const { itemId, read } = request;
	return store.commitLocal(() => {
		const snapshot = read(itemId);
		const { result, writes } = decide(snapshot);
		if (writes) persistDecision(target, { snapshot, writes }, now());
		const fields = writes?.item && dispatchJournalFields(writes.item);
		return { result, operation: fields && { itemId, fields } };
	});
}

function persistDecision(
	{ store, node, onStartupFailure }: TrackerDispatchCommitTarget,
	{ snapshot, writes }: { snapshot: TrackerDispatchSnapshot; writes: TrackerDispatchWrites },
	at: number
) {
	for (const run of writes.runs ?? []) persistDispatchRun(store, run, node);
	recordLaunchEvents(store.database, { snapshot, writes }, at);
	if (writes.startupFailure) onStartupFailure?.(writes.startupFailure, at);
	if (writes.lastDueStartAt !== undefined)
		store.writeMeta({ [dueStartKey]: String(writes.lastDueStartAt) });
}
