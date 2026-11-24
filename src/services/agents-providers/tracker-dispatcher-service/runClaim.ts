// @harness-uid u_rzpjc6wqqy
import type {
	TrackerDispatchDecision,
	TrackerDispatchItem,
	TrackerDispatchPolicy,
	TrackerDispatchSnapshot,
	TrackerDueGrant,
	TrackerLaunchIntent,
	TrackerLaunchRung,
	TrackerRunReceipt
} from '../TrackerDispatcherService.types';
import {
	attemptKey,
	canonicalNode,
	dueItemHold,
	hasOpenSession,
	matchesRequest,
	mayScheduleHere,
	minute,
	ownsLaunch,
	skip,
	startable
} from './launchEligibility';
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
	const pick = item.launch.scheduledPick ?? policy.pickModel(item);
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
	if (run.state !== 'queued' || run.dispatch_at !== undefined || run.cli === 'none') {
		return skip('ignored', 'attempt is no longer awaiting dispatch');
	}
	if (item?.launch?.token !== run.auto_token || expiredUnavailableRetry(item, run, now))
		return retireUnstartedRun(snapshot, run, { policy, now });
	const hold = claimHold(snapshot, { item, grant, run }, policy, now);
	if (hold) return skip('held', hold);
	const rung = {
		id: run.rung,
		cli: run.cli,
		model: run.model,
		effort: run.effort,
		pinned: run.pinned
	};
	const problem = policy.admit(item, item.launch, rung);
	if (problem) return skip('held', problem);
	return reserveStart(item, { run, rung }, policy, now);
}

function expiredUnavailableRetry(item: TrackerDispatchItem, run: TrackerRunReceipt, now: number) {
	return !startable(item) && now - run.queued_at >= launchStartupGrace;
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
	const failure = { outcome: 'abandoned', reason: 'launch expired before startup', now } as const;
	if (run.dispatch_at !== undefined && startable(item))
		return failRun(snapshot, run, { ...failure, startup: true }, clock);
	return recordRun(finishRun(run, failure), { launch: null });
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
	if (policy.enabled === false) return 'launcher disabled';
	if (!startable(item)) return 'item is not startable';
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

function dueGrantHold(
	{ due, lastDueStartAt }: TrackerDispatchSnapshot,
	{
		item,
		intent,
		grant
	}: { item: TrackerDispatchItem; intent: TrackerLaunchIntent; grant?: TrackerDueGrant },
	policy: TrackerDispatchPolicy,
	now: number
): string | null {
	if (!due || due.paused) return 'due scheduler unavailable or paused';
	const canSchedule = mayScheduleHere(item, due, policy);
	if (policy.hub)
		return hubHold(item, { enabled: due.enabled, canSchedule, lastDueStartAt }, policy, now);
	if (
		grant?.token !== intent.token ||
		canonicalNode(grant.node, policy) !== canonicalNode(policy.node, policy)
	) {
		return 'waiting for the hub to authorize due launch';
	}
	return acceptsGrant(grant, canSchedule, Boolean(item.adapterDueOwner))
		? null
		: 'waiting for the hub to authorize due launch';
}

function acceptsGrant(grant: TrackerDueGrant, canSchedule: boolean, isAdapterDue: boolean) {
	if (grant.decision === 'unreachable') return canSchedule;
	return grant.decision === 'granted' && (!isAdapterDue || canSchedule);
}

function hubHold(
	item: TrackerDispatchItem,
	{
		enabled,
		canSchedule,
		lastDueStartAt
	}: { enabled: boolean; canSchedule: boolean; lastDueStartAt?: number },
	policy: TrackerDispatchPolicy,
	now: number
) {
	if (item.adapterDueOwner ? !canSchedule : !enabled) return 'due scheduler disabled for this item';
	const interval = policy.dueIntervalMs ?? 15_000;
	return lastDueStartAt !== undefined && now - lastDueStartAt < interval
		? 'due launch interval has not elapsed'
		: null;
}

function reserveStart(
	item: TrackerDispatchItem,
	{ run, rung }: { run: TrackerRunReceipt; rung: TrackerLaunchRung },
	policy: TrackerDispatchPolicy,
	now: number
): TrackerDispatchDecision {
	const intent = item.launch!;
	const reserved = reviseRun(run, { dispatch_at: now, eta_at: etaFor(item, policy, now) });
	return {
		result: {
			status: 'start',
			run: reserved,
			key: attemptKey(reserved),
			selection: { provider: rung.cli, model: rung.model, intelligence: rung.effort ?? '' }
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
