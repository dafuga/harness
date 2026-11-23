// @harness-uid u_rzpjc6wqqy
import type {
	TrackerDispatchDecision,
	TrackerDispatchEvent,
	TrackerDispatchItem,
	TrackerDispatchPolicy,
	TrackerDispatchSnapshot,
	TrackerReceiptUsage,
	TrackerRunReceipt
} from '../TrackerDispatcherService.types';
import { inactive, matchesRequest, minute, skip } from './launchEligibility';
import { failRun, finishRun, recordRun, reviseRun } from './runReceipt';

export function monitorRun(
	snapshot: TrackerDispatchSnapshot,
	run: TrackerRunReceipt,
	event: Extract<TrackerDispatchEvent, { type: 'monitor' }>,
	clock: { policy: TrackerDispatchPolicy; now: number }
): TrackerDispatchDecision {
	if (run.state === 'finished') return skip('ignored', 'attempt already finished');
	if (run.state === 'queued') return monitorQueued(snapshot, run, clock);
	const { item } = snapshot;
	if (item?.deleted) return abandon(run, 'item deleted', clock.now);
	if (item?.status === 'done') return monitorDone(snapshot, run, event, clock);
	if (run.state === 'verifying') {
		if (!item) return skip('held', 'item missing during verification');
		return recordRun(reviseRun(run, { state: 'running' }));
	}
	return monitorRunning(snapshot, run, event, clock);
}

function monitorQueued(
	{ item }: TrackerDispatchSnapshot,
	run: TrackerRunReceipt,
	{ policy, now }: { policy: TrackerDispatchPolicy; now: number }
): TrackerDispatchDecision {
	if (!item) {
		const expired = now - run.queued_at > (policy.maxRunMinutes ?? 480) * minute;
		return expired ? abandon(run, 'item missing', now) : skip('held', 'item missing');
	}
	if (inactive(item) || !matchesRequest(item, run, policy)) {
		return abandon(run, 'item inactive or launch request changed', now);
	}
	return skip('held', 'awaiting runner observation');
}

function monitorDone(
	snapshot: TrackerDispatchSnapshot,
	run: TrackerRunReceipt,
	event: Extract<TrackerDispatchEvent, { type: 'monitor' }>,
	{ policy, now }: { policy: TrackerDispatchPolicy; now: number }
): TrackerDispatchDecision {
	if (snapshot.item?.closedBySource) return abandon(run, 'linked source closed the item', now);
	const verificationFor = snapshot.item?.completionVersion;
	if (run.state === 'verifying' && run.verificationFor === verificationFor) {
		return skip('held', 'waiting for verification result');
	}
	if (event.verify || run.state === 'verifying')
		return recordRun(reviseRun(run, { state: 'verifying', verificationFor }));
	return completeRun(snapshot, run, { policy, now, usage: event.usage });
}

function monitorRunning(
	snapshot: TrackerDispatchSnapshot,
	run: TrackerRunReceipt,
	event: Extract<TrackerDispatchEvent, { type: 'monitor' }>,
	clock: { policy: TrackerDispatchPolicy; now: number }
): TrackerDispatchDecision {
	const { item } = snapshot;
	const { policy, now } = clock;
	if (!item) {
		return event.session === 'exited' || pastRunCap(run, policy, now)
			? abandon(run, 'item missing', now)
			: skip('held', 'item missing');
	}
	if (item.status === 'blocked') {
		return recordRun(
			finishRun(run, {
				outcome: 'blocked',
				reason: item.blockedReason ?? null,
				now,
				usage: event.usage
			})
		);
	}
	if (event.session === 'exited' || event.exitCode != null) {
		const code = event.exitCode;
		const reason = `session exited without tracker done${code == null ? '' : ` (exit ${code})`}`;
		return failRun(
			snapshot,
			run,
			{ outcome: 'failed', reason, exitCode: code, usage: event.usage },
			clock
		);
	}
	const timeout = timeoutReason(run, item, event, clock);
	if (timeout)
		return failRun(
			snapshot,
			run,
			{ outcome: 'timed_out', reason: timeout, usage: event.usage },
			clock
		);
	return skip('held', 'run still active');
}

function timeoutReason(
	run: TrackerRunReceipt,
	item: TrackerDispatchItem,
	event: Extract<TrackerDispatchEvent, { type: 'monitor' }>,
	{ policy, now }: { policy: TrackerDispatchPolicy; now: number }
) {
	if (pastRunCap(run, policy, now)) return `ran past the ${policy.maxRunMinutes ?? 480} min cap`;
	if (event.idleReview && item.awaitingAnswer) return null;
	const activity = lastActivity(run, item, event.activityAt);
	if (
		run.eta_at == null ||
		now <= run.eta_at ||
		now - activity <= (policy.stallMinutes ?? 45) * minute
	)
		return null;
	return `stalled past its ETA (no activity for ${Math.round((now - activity) / minute)} min)`;
}

function lastActivity(run: TrackerRunReceipt, item: TrackerDispatchItem, activityAt = 0) {
	return Math.max(activityAt, item.updatedAt ?? 0, activeSince(run));
}

function activeSince(run: TrackerRunReceipt) {
	return run.resumed_at ?? run.started_at ?? run.queued_at;
}

function pastRunCap(run: TrackerRunReceipt, policy: TrackerDispatchPolicy, now: number) {
	return now - activeSince(run) > (policy.maxRunMinutes ?? 480) * minute;
}

function abandon(run: TrackerRunReceipt, reason: string, now: number) {
	return recordRun(finishRun(run, { outcome: 'abandoned', reason, now }));
}

export function completeRun(
	snapshot: TrackerDispatchSnapshot,
	run: TrackerRunReceipt,
	{
		policy,
		now,
		usage
	}: { policy: TrackerDispatchPolicy; now: number; usage?: TrackerReceiptUsage }
): TrackerDispatchDecision {
	const keep = run.launch_source === 'due' ? 0 : (policy.keepSessionMinutes ?? 30) * minute;
	const finished = {
		...finishRun(run, { outcome: 'done', reason: null, now, usage }),
		kill_at: now + keep
	};
	const redone = snapshot.runs
		.filter((prior) => canCredit(prior, run))
		.map((prior) => reviseRun(prior, { redone_by: run.rung }));
	return { result: { status: 'recorded', run: finished }, writes: { runs: [finished, ...redone] } };
}

function canCredit(prior: TrackerRunReceipt, run: TrackerRunReceipt) {
	return (
		prior.node === run.node &&
		prior.revision >= 0 &&
		prior.id < run.id &&
		!prior.redone_by &&
		(prior.outcome === 'failed' || prior.outcome === 'rejected' || prior.outcome === 'timed_out')
	);
}
