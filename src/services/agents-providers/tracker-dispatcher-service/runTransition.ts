// @harness-uid u_rzpjc6wqqy
import type {
	TrackerDispatchDecision,
	TrackerDispatchEvent,
	TrackerDispatchItem,
	TrackerDispatchPolicy,
	TrackerDispatchSnapshot,
	TrackerRunReceipt,
	TrackerSessionEvidence
} from '../TrackerDispatcherService.types';
import {
	attemptKey,
	automaticRequestHold,
	hasOpenSession,
	matchesRequest,
	skip
} from './launchEligibility';
import { retireUnstartedRun } from './runClaim';
import { completeRun, monitorRun } from './runMonitor';
import { etaFor, failRun, recordRun, reviseRun } from './runReceipt';

export function transitionRun(
	snapshot: TrackerDispatchSnapshot,
	run: TrackerRunReceipt,
	event: TrackerDispatchEvent,
	clock: { policy: TrackerDispatchPolicy; now: number }
): TrackerDispatchDecision {
	switch (event.type) {
		case 'session':
			return adoptSession(run, event.session, clock, snapshot);
		case 'monitor':
			return monitorRun(snapshot, run, event, clock);
		case 'startup-failed':
			return recordStartupFailure(snapshot, run, event, clock);
		case 'never-started':
			return retireUnstartedRun(snapshot, run, clock);
		case 'verified':
			return recordVerification(snapshot, run, event, clock);
		case 'resume':
			return resumeRun(snapshot, run, event.session, clock);
		case 'reject':
			return rejectRun(snapshot, run, event.reason, clock);
	}
	return skip('ignored', 'unknown run event');
}

function adoptSession(
	run: TrackerRunReceipt,
	session: TrackerSessionEvidence,
	{ policy, now }: { policy: TrackerDispatchPolicy; now: number },
	snapshot: TrackerDispatchSnapshot
) {
	if (
		run.state !== 'queued' ||
		run.dispatch_at === undefined ||
		!matchesSession(run, session, now)
	) {
		return skip('ignored', 'session does not match a queued reservation');
	}
	return recordRun(
		reviseRun(run, {
			state: 'running',
			session_id: session.id,
			...(session.tmux && { tmux: session.tmux }),
			started_at: session.startedAt,
			eta_at: run.eta_at ?? etaFor(snapshot.item, policy, now)
		})
	);
}

function matchesSession(run: TrackerRunReceipt, session: TrackerSessionEvidence, now: number) {
	return (
		session.key === attemptKey(run) &&
		Boolean(session.id) &&
		session.startedAt >= run.queued_at &&
		session.startedAt <= now
	);
}

function recordStartupFailure(
	snapshot: TrackerDispatchSnapshot,
	run: TrackerRunReceipt,
	event: Extract<TrackerDispatchEvent, { type: 'startup-failed' }>,
	clock: { policy: TrackerDispatchPolicy; now: number }
) {
	if (run.dispatch_at === undefined || (run.state !== 'queued' && run.state !== 'running')) {
		return skip('ignored', 'attempt is no longer starting');
	}
	return failRun(
		snapshot,
		run,
		{
			outcome: 'abandoned',
			reason: event.reason,
			exitCode: event.exitCode,
			startup: true
		},
		clock
	);
}

function recordVerification(
	snapshot: TrackerDispatchSnapshot,
	run: TrackerRunReceipt,
	event: Extract<TrackerDispatchEvent, { type: 'verified' }>,
	{ policy, now }: { policy: TrackerDispatchPolicy; now: number }
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
	if (event.passed) return completeRun(snapshot, run, { policy, now, usage: event.usage });
	return failRun(
		snapshot,
		run,
		{
			outcome: 'failed',
			reason: event.reason ?? 'verification failed',
			reopen: true,
			usage: event.usage
		},
		{ policy, now }
	);
}

function resumeRun(
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
	{ policy, now }: { policy: TrackerDispatchPolicy; now: number }
) {
	const { item, runs } = snapshot;
	return (
		run.state === 'finished' &&
		run.outcome === 'blocked' &&
		Boolean(run.host_session_id ?? run.session_id) &&
		answeredBlock(item) &&
		item &&
		!automaticRequestHold({ ...item, status: 'in_progress' }, policy, now) &&
		matchesRequest(item, run, policy) &&
		!hasOpenSession(snapshot, policy, now, run) &&
		!runs.some((later) => later.node === run.node && later.id > run.id && later.started_at !== null)
	);
}

function answeredBlock(item: TrackerDispatchItem | null) {
	return (
		item?.answeredCurrentBlock === true &&
		!item.awaitingAnswer &&
		!item.deleted &&
		(item.status === 'blocked' || item.status === 'in_progress')
	);
}

function rejectRun(
	snapshot: TrackerDispatchSnapshot,
	run: TrackerRunReceipt,
	reason: string,
	clock: { policy: TrackerDispatchPolicy; now: number }
) {
	const { item, runs } = snapshot;
	const latest = !runs.some((later) => later.node === run.node && later.id > run.id);
	if (
		run.outcome !== 'done' ||
		item?.status !== 'done' ||
		item.deleted ||
		!latest ||
		!matchesRequest(item, run, clock.policy)
	) {
		return skip('conflict', 'attempt is no longer the current completed launch');
	}
	return failRun(
		snapshot,
		run,
		{
			outcome: 'rejected',
			reason: reason.trim() || 'rejected by Daniel',
			reopen: true
		},
		clock
	);
}
