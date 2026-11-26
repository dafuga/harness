// @harness-uid u_ksy76trvsj
import type {
	TrackerDispatchDecision,
	TrackerDispatchResult,
	TrackerDispatchSnapshot
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
	const { store, node, now = Date.now } = target;
	const { itemId, read } = request;
	return store.commitLocal(() => {
		const snapshot = read(itemId);
		const { result, writes } = decide(snapshot);
		for (const run of writes?.runs ?? []) persistDispatchRun(store, run, node);
		recordLaunchEvents(store.database, { snapshot, writes }, now());
		if (writes?.lastDueStartAt !== undefined)
			store.writeMeta({ [dueStartKey]: String(writes.lastDueStartAt) });
		const fields = writes?.item && dispatchJournalFields(writes.item);
		return { result, operation: fields && { itemId, fields } };
	});
}
