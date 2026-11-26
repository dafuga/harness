// @harness-uid u_rzpjc6wqqy
import type {
	TrackerDispatchDecision,
	TrackerDispatchEvent,
	TrackerDispatchPolicy,
	TrackerDispatchSnapshot,
	TrackerRunReceipt,
	TrackerSessionEvidence
} from '../TrackerDispatcherService.types';
import { matchesRequest, skip } from './launchEligibility';
import { retireUnstartedRun } from './runClaim';
import { completeRun, monitorRun } from './runMonitor';
import { matchesSession, recordFinalReport, reopenAnswered, resumeRun } from './runResume';
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
		case 'answered-without-session':
			return reopenAnswered(snapshot, run, clock);
		case 'final-report':
			return recordFinalReport(snapshot, run, event, clock.now);
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
	if (event.passed) return completeRun(snapshot, run, { now, usage: event.usage });
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
