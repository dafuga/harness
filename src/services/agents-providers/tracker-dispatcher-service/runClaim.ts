// @harness-uid u_rzpjc6wqqy
import type {
	TrackerDispatchDecision,
	TrackerDispatchItem,
	TrackerDispatchPolicy,
	TrackerDispatchSnapshot,
	TrackerDueGrant,
	TrackerLaunchRung,
	TrackerRunReceipt
} from '../TrackerDispatcherService.types';
import {
	attemptKey,
	automaticRequestHold,
	continuesStartedRun,
	dueItemHold,
	hasOpenSession,
	matchesRequest,
	minute,
	ownsLaunch,
	schedulingHold,
	skip,
	startable
} from './launchEligibility';
import { dueGrantHold } from './dueGrantHold';
import { currentPick, redirectedRun } from './providerRedirect';
import { etaFor, failRun, finishRun, queueRun, recordRun, reviseRun } from './runReceipt';

// Give an interrupted host start time to publish its session evidence.
export const launchStartupGrace = 5 * minute;

export function claimLaunch(
	snapshot: TrackerDispatchSnapshot,
	{ token, grant }: { token: string; grant?: TrackerDueGrant },
	policy: TrackerDispatchPolicy,
	now: number
): TrackerDispatchDecision {
	const { item } = snapshot;
	if (item?.launch?.token !== token) return skip('held', 'launch request changed or is missing');
	if (snapshot.runs.some((run) => run.auto_token === token))
		return skip('held', 'launch token was already claimed');
	const hold = claimHold(snapshot, { item, grant }, policy, now);
	if (hold) return skip('held', hold);
	const pick = currentPick(item, item.launch.scheduledPick ?? policy.pickModel(item), policy);
	const problem = policy.admit(item, item.launch, 'error' in pick ? null : pick.rung);
	if (problem) return skip('held', problem);
	const run = queueRun(snapshot, { token, item, pick }, policy, now);
	if ('error' in pick) return invalidPick(run, pick.error, now);
	return reserveStart(item, { run, rung: pick.rung }, policy, now);
}

export function prepareRetry(
	snapshot: TrackerDispatchSnapshot,
	{ run, grant }: { run: TrackerRunReceipt; grant?: TrackerDueGrant },
	policy: TrackerDispatchPolicy,
	now: number
): TrackerDispatchDecision {
	const { item } = snapshot;
	if (!awaitingRetry(run)) {
		return skip('ignored', 'attempt is no longer awaiting dispatch');
	}
	if (!item || item.launch?.token !== run.auto_token)
		return retireUnstartedRun(snapshot, run, { policy, now });
	const itemHold = schedulingHold(item, now);
	if (itemHold)
		return recordRun(finishRun(run, { outcome: 'abandoned', reason: itemHold, now }), {
			launch: null
		});
	const hold = claimHold(snapshot, { item, grant, run }, policy, now);
	if (hold) return skip('held', hold);
	const redirected = policy.redirectPick?.(item, run);
	const rung = redirected?.rung ?? {
		id: run.rung,
		cli: run.cli,
		model: run.model,
		effort: run.effort,
		pinned: run.pinned
	};
	const problem = policy.admit(item, item.launch, rung);
	if (problem) {
		if (problem === run.failure_reason) return skip('held', problem);
		return {
			result: { status: 'held', reason: problem },
			writes: { runs: [reviseRun(run, { failure_reason: problem })] }
		};
	}
	const next = redirected ? redirectedRun(run, redirected) : run;
	return reserveStart(item, { run: next, rung }, policy, now);
}

function awaitingRetry(
	run: TrackerRunReceipt
): run is TrackerRunReceipt & { cli: Exclude<TrackerRunReceipt['cli'], 'none'> } {
	return run.state === 'queued' && run.dispatch_at === undefined && run.cli !== 'none';
}

export function retireUnstartedRun(
	snapshot: TrackerDispatchSnapshot,
	run: TrackerRunReceipt,
	clock: { policy: TrackerDispatchPolicy; now: number }
): TrackerDispatchDecision {
	const { item } = snapshot;
	const { now, policy } = clock;
	if (!unstartedRun(snapshot, run))
		return skip('ignored', 'attempt is no longer an unstarted launch');
	if (item?.launch?.token !== run.auto_token)
		return recordRun(
			finishRun(run, { outcome: 'abandoned', reason: 'launch cancelled before startup', now })
		);
	if (
		!matchesRequest(item, run, policy) ||
		now - (run.dispatch_at ?? run.queued_at) < launchStartupGrace
	)
		return skip('ignored', 'launch reservation is owned elsewhere or still within startup grace');
	const failure = expiredStart(run, now);
	if (run.dispatch_at !== undefined && startable(item))
		return failRun(snapshot, run, { ...failure, startup: true }, clock);
	return recordRun(finishRun(run, failure), { launch: null });
}

function expiredStart({ failure_reason: cause }: TrackerRunReceipt, now: number) {
	const reason = `launch expired before startup${cause ? `: ${cause}` : ''}`;
	return { outcome: 'abandoned', reason, now } as const;
}

function unstartedRun({ activeSessionKeys }: TrackerDispatchSnapshot, run: TrackerRunReceipt) {
	return (
		run.state === 'queued' &&
		run.started_at === null &&
		![run.session_id, run.host_session_id, run.tmux].some(Boolean) &&
		!activeSessionKeys?.includes(attemptKey(run))
	);
}

function claimHold(
	snapshot: TrackerDispatchSnapshot,
	{
		item,
		grant,
		run
	}: { item: TrackerDispatchItem; grant?: TrackerDueGrant; run?: TrackerRunReceipt },
	policy: TrackerDispatchPolicy,
	now: number
): string | null {
	const intent = item.launch!;
	const eligibility = claimItemHold(
		item,
		{ retry: Boolean(run), runs: snapshot.runs },
		policy,
		now
	);
	if (eligibility) return eligibility;
	if (!ownsLaunch(intent, policy)) return 'launch is assigned to a different computer';
	if (hasOpenSession(snapshot, policy, now, run)) return 'item already has an open session';
	if (intent.source !== 'due') return null;
	const previouslyStarted = snapshot.runs.some(
		({ auto_token, started_at }) => auto_token === intent.token && started_at !== null
	);
	if (item.status !== 'open' && !previouslyStarted) return 'due item is already in progress';
	return (
		dueItemHold(item, policy, now) ?? dueGrantHold(snapshot, { item, intent, grant }, policy, now)
	);
}

function claimItemHold(
	item: TrackerDispatchItem,
	{ retry, runs }: { retry: boolean; runs: TrackerDispatchSnapshot['runs'] },
	policy: TrackerDispatchPolicy,
	now: number
) {
	if (policy.enabled === false) return 'launcher disabled';
	const { source } = item.launch!;
	if (source !== 'manual' || retry) {
		const hold = automaticRequestHold(item, policy, now, continuesStartedRun(source, runs, policy));
		if (hold) return hold;
	}
	if (!startable(item)) return 'item is not startable';
	return null;
}

function reserveStart(
	item: TrackerDispatchItem,
	{ run, rung }: { run: TrackerRunReceipt; rung: TrackerLaunchRung },
	policy: TrackerDispatchPolicy,
	now: number
): TrackerDispatchDecision {
	const intent = item.launch!;
	// A run queued before the model change starts on its replacement.
	const model = rung.model === 'gpt-6.1-sol' ? 'gpt-6.2-sol' : rung.model;
	const reserved = reviseRun(run, { model, dispatch_at: now, eta_at: etaFor(item, policy, now) });
	return {
		result: {
			status: 'start',
			run: reserved,
			key: attemptKey(reserved),
			selection: { provider: rung.cli, model, intelligence: rung.effort ?? '' }
		},
		writes: {
			runs: [reserved],
			...(policy.hub && intent.source === 'due' && { lastDueStartAt: now })
		}
	};
}

function invalidPick(run: TrackerRunReceipt, reason: string, now: number): TrackerDispatchDecision {
	return recordRun(finishRun(run, { outcome: 'abandoned', reason, now }), {
		status: 'blocked',
		awaitingAnswer: true,
		answeredCurrentBlock: false,
		blockedReason: `auto-launch: ${reason}`
	});
}
