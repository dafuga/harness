// @harness-uid u_rzpjc6wqqy
import type {
	TrackerDispatchDecision,
	TrackerDispatchEvent,
	TrackerDispatchPolicy,
	TrackerDispatchSnapshot,
	TrackerRunReceipt,
	TrackerSessionEvidence
} from '../TrackerDispatcherService.types';
import { skip } from './launchEligibility';
import { retireUnstartedRun } from './runClaim';
import { monitorRun } from './runMonitor';
import { recordVerification, rejectRun } from './runReview';
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
			...(session.sourceRepo && { source_repo: session.sourceRepo }),
			...(session.sessionName && { session_name: session.sessionName }),
			failure_reason: null,
			eta_at: run.eta_at ?? etaFor(snapshot.item, policy, now)
		}),
		recoveryStarted(snapshot.item, run)
	);
}

function recoveryStarted(item: TrackerDispatchSnapshot['item'], run: TrackerRunReceipt) {
	if (
		run.launch_source === 'recovery' &&
		item?.status === 'open' &&
		item.launch?.token === run.auto_token
	)
		return { status: 'in_progress' as const };
	return undefined;
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
	if (event.pending) return recordPendingCause(run, event.reason);
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

/** The session may still appear, so the cause waits on the reservation until it expires. */
function recordPendingCause(run: TrackerRunReceipt, reason: string) {
	if (run.state !== 'queued') return skip('ignored', 'attempt is no longer starting');
	return recordRun(reviseRun(run, { failure_reason: reason }));
}
