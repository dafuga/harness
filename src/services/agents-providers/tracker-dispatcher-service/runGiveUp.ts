// @harness-uid u_rzpjc6wqqy
import type {
	TrackerDispatchItem,
	TrackerDispatchPolicy,
	TrackerDispatchSnapshot,
	TrackerDispatchWrites,
	TrackerLaunchPick,
	TrackerRunReceipt
} from '../TrackerDispatcherService.types';

export function pickRetryModel(
	item: TrackerDispatchItem,
	run: TrackerRunReceipt,
	policy: TrackerDispatchPolicy
): TrackerLaunchPick | { error: string } {
	// Abandoned predecessors with a retry are failed startups.
	if (item.model || run.outcome === 'abandoned') return policy.pickModel(item);
	const rung = policy.retryModel(item, run);
	if (!rung) return { error: 'no eligible retry model' };
	return { rung, kind: run.kind ?? item.kind, reason: `retry after ${run.rung} ${run.outcome}` };
}

export function pickQueuedRetryModel(
	item: TrackerDispatchItem,
	run: TrackerRunReceipt,
	runs: readonly TrackerRunReceipt[],
	policy: TrackerDispatchPolicy
) {
	const prior = runs.find(
		(candidate) =>
			candidate.id === run.escalated_from &&
			candidate.node === run.node &&
			candidate.auto_token === run.auto_token
	);
	return prior ? pickRetryModel(item, prior, policy) : policy.pickModel(item);
}

export function pickLaunchModel(item: TrackerDispatchItem, policy: TrackerDispatchPolicy) {
	const scheduled = item.launch?.source === 'due' ? item.launch.scheduledPick : undefined;
	return scheduled ?? policy.pickModel(item);
}

export function giveUp(
	snapshot: TrackerDispatchSnapshot,
	run: TrackerRunReceipt,
	reopen?: TrackerDispatchWrites['item'],
	pickError?: string
): TrackerDispatchWrites['item'] {
	const { item, runs } = snapshot;
	if (!item || (item.status === 'done' && !reopen)) return undefined;
	const history = runs
		.filter((attempt) => attempt.auto_token === run.auto_token && attempt.id !== run.id)
		.map(({ rung, outcome }) => `${rung}: ${outcome}`);
	history.push(`${run.rung}: ${run.outcome}`);
	const pickNote = pickError ? `; retry selection: ${pickError}` : '';
	const reason = `auto-launch gave up after ${run.attempt} attempt(s) (${history.join(', ')}); last: ${run.failure_reason}${pickNote}`;
	return {
		...reopen,
		status: 'blocked',
		awaitingAnswer: true,
		answeredCurrentBlock: false,
		blockedReason: reason,
		question: `Blocked: ${reason}`,
		appendNote: [reopen?.appendNote, `blocked: ${reason}`].filter(Boolean).join('\n')
	};
}
