// @harness-uid u_rzpjc6wqqy
import type {
	TrackerDispatchDecision,
	TrackerDispatchItem,
	TrackerDispatchPolicy,
	TrackerDispatchSnapshot,
	TrackerRunReceipt,
	TrackerSessionEvidence
} from '../TrackerDispatcherService.types';
import type { TrackerFinalReportEvent } from './runReceipt.types';
import {
	attemptKey,
	automaticRequestHold,
	hasOpenSession,
	matchesRequest,
	skip
} from './launchEligibility';
import { etaFor, finishRun, recordRun, reviseRun } from './runReceipt';

export function matchesSession(
	run: TrackerRunReceipt,
	session: TrackerSessionEvidence,
	now: number
) {
	return (
		session.key === attemptKey(run) &&
		Boolean(session.id) &&
		session.startedAt >= run.queued_at &&
		session.startedAt <= now
	);
}

export function resumeRun(
	snapshot: TrackerDispatchSnapshot,
	run: TrackerRunReceipt,
	session: TrackerSessionEvidence,
	{ policy, now }: { policy: TrackerDispatchPolicy; now: number }
) {
	const { item } = snapshot;
	if (!canResume(snapshot, run, { policy, now }))
		return skip('ignored', 'no current answer for this blocked attempt');
	if (
		!matchesSession(run, session, now) ||
		session.state !== 'live' ||
		session.id !== (run.host_session_id ?? run.session_id)
	) {
		return skip('ignored', 'the original session is no longer live');
	}
	return recordRun(
		reviseRun(run, {
			state: 'running',
			outcome: null,
			failure_reason: null,
			ended_at: null,
			resumed_at: Math.max(now, (run.resumed_at ?? 0) + 1),
			eta_at: etaFor(item, policy, now)
		}),
		{ status: 'in_progress', blockedReason: null }
	);
}

function canResume(
	snapshot: TrackerDispatchSnapshot,
	run: TrackerRunReceipt,
	clock: { policy: TrackerDispatchPolicy; now: number }
) {
	return Boolean(run.host_session_id ?? run.session_id) && answeredRun(snapshot, run, clock);
}

/** The latest blocked attempt of this request has its answer and may continue. */
function answeredRun(
	snapshot: TrackerDispatchSnapshot,
	run: TrackerRunReceipt,
	{ policy, now }: { policy: TrackerDispatchPolicy; now: number }
) {
	const { item, runs } = snapshot;
	return (
		run.state === 'finished' &&
		run.outcome === 'blocked' &&
		answeredBlock(item) &&
		item &&
		!automaticRequestHold(
			{ ...item, status: 'in_progress' },
			policy,
			now,
			run.started_at !== null
		) &&
		matchesRequest(item, run, policy) &&
		!hasOpenSession(snapshot, policy, now, run) &&
		!runs.some((later) => later.node === run.node && later.id > run.id && later.started_at !== null)
	);
}

/** The blocked session was closed with its run, so reopen the item for a fresh recovery launch. */
export function reopenAnswered(
	snapshot: TrackerDispatchSnapshot,
	run: TrackerRunReceipt,
	clock: { policy: TrackerDispatchPolicy; now: number }
): TrackerDispatchDecision {
	if (snapshot.item?.status !== 'blocked' || !answeredRun(snapshot, run, clock))
		return skip('ignored', 'no current answer for this blocked attempt');
	return {
		result: { status: 'recorded', run },
		writes: { item: { status: 'in_progress', blockedReason: null } }
	};
}

export function recordFinalReport(
	snapshot: TrackerDispatchSnapshot,
	run: TrackerRunReceipt,
	report: TrackerFinalReportEvent,
	now: number
): TrackerDispatchDecision {
	const { item } = snapshot;
	const { outcome, reason } = report;
	if (run.state !== 'running' || (item?.status !== 'open' && item?.status !== 'in_progress'))
		return skip('ignored', 'attempt or item changed since its final report');
	return recordRun(finishRun(run, { outcome, reason, now }));
}

function answeredBlock(item: TrackerDispatchItem | null) {
	return (
		item?.answeredCurrentBlock === true &&
		!item.awaitingAnswer &&
		!item.deleted &&
		(item.status === 'blocked' || item.status === 'in_progress')
	);
}
