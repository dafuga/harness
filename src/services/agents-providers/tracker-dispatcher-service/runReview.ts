// @harness-uid u_rzpjc6wqqy
import type {
	TrackerDispatchDecision,
	TrackerDispatchEvent,
	TrackerDispatchSnapshot,
	TrackerRunReceipt
} from '../TrackerDispatcherService.types';
import { canonicalNode, skip } from './launchEligibility';
import { completeRun } from './runMonitor';
import { failRun, reviseRun } from './runReceipt';
import type { Clock } from './runReview.types';

export function recordVerification(
	snapshot: TrackerDispatchSnapshot,
	run: TrackerRunReceipt,
	event: Extract<TrackerDispatchEvent, { type: 'verified' }>,
	clock: Clock
) {
	const { item } = snapshot;
	if (
		run.state !== 'verifying' ||
		item?.status !== 'done' ||
		item.deleted ||
		item.closedBySource ||
		run.verificationFor !== item.completionVersion
	) {
		return skip('ignored', 'verification no longer applies to this attempt');
	}
	if (event.passed) return completeRun(snapshot, run, { now: clock.now, usage: event.usage });
	return failRun(
		snapshot,
		run,
		{
			outcome: 'failed',
			reason: event.reason ?? 'verification failed',
			note: event.note,
			reopen: true,
			usage: event.usage
		},
		clock
	);
}

export function rejectRun(
	snapshot: TrackerDispatchSnapshot,
	run: TrackerRunReceipt,
	reason: string,
	clock: Clock
) {
	const { item } = snapshot;
	if (run.outcome !== 'done' || item?.status !== 'done' || item.deleted || !isLatest(snapshot, run))
		return skip('conflict', 'attempt is no longer the current completed launch');
	const why = rejectionReason(reason);
	return failRun(
		snapshot,
		run,
		{ outcome: 'rejected', reason: why, note: `rejected: ${why}`, reopen: true },
		clock
	);
}

/**
 * Daniel rejected a completed result. This node's latest attempt is charged when it produced the
 * completion; without one the item is only reopened.
 */
export function rejectCompletion(
	snapshot: TrackerDispatchSnapshot,
	reason: string,
	clock: Clock
): TrackerDispatchDecision {
	if (snapshot.item?.status !== 'done' || snapshot.item.deleted)
		return skip('conflict', 'only a completed item can be rejected');
	const node = canonicalNode(clock.policy.node, clock.policy);
	const local = snapshot.runs.filter((run) => run.node === node);
	const active = local.find((run) => run.state === 'running' || run.state === 'verifying');
	if (active)
		return skip(
			'conflict',
			`run #${active.id} is still ${finishing(active)}; reject it once it records done`
		);
	const latest = local.sort((a, b) => a.id - b.id).at(-1);
	if (latest?.outcome === 'done' && latest.revision >= 0)
		return rejectRun(snapshot, latest, reason, clock);
	const appendNote = `rejected: ${rejectionReason(reason)}`;
	return {
		result: { status: 'ignored', reason: 'no auto-run to charge' },
		writes: { item: { status: 'open', appendNote } }
	};
}

/** The item was finished by hand: the redo of these failed attempts was human. */
export function creditHumanRedo(
	snapshot: TrackerDispatchSnapshot,
	ids: readonly number[],
	clock: Clock
): TrackerDispatchDecision {
	const { item, runs } = snapshot;
	if (item?.status !== 'done' || item.deleted) return skip('ignored', 'item is not finished');
	const node = canonicalNode(clock.policy.node, clock.policy);
	const redone = runs
		.filter(
			(run) => run.node === node && ids.includes(run.id) && run.revision >= 0 && !run.redone_by
		)
		.map((run) => reviseRun(run, { redone_by: 'human' }));
	return { result: { status: 'ignored', reason: 'human redo' }, writes: { runs: redone } };
}

export function rejectionReason(reason: string) {
	return reason.trim() || 'rejected by Daniel';
}

function isLatest({ runs }: TrackerDispatchSnapshot, run: TrackerRunReceipt) {
	return !runs.some((later) => later.node === run.node && later.id > run.id);
}

function finishing(run: TrackerRunReceipt) {
	return run.state === 'verifying' ? 'verifying' : 'finishing';
}
