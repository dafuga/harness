// @harness-uid u_rzpjc6wqqy
import type {
	TrackerDispatchDecision,
	TrackerDispatchItem,
	TrackerDispatchPolicy,
	TrackerDispatchSnapshot,
	TrackerLaunchRequest
} from '../TrackerDispatcherService.types';
import {
	automaticRequestHold,
	canonicalNode,
	knownNode,
	startable,
	hasOpenSession,
	skip
} from './launchEligibility';
import { queueRun } from './runReceipt';

export function recoveryIntent(
	snapshot: TrackerDispatchSnapshot,
	{
		item,
		request
	}: { item: TrackerDispatchItem; request: Extract<TrackerLaunchRequest, { source: 'recovery' }> },
	policy: TrackerDispatchPolicy,
	now: number
): TrackerDispatchDecision {
	if (!recoveringItem(item))
		return skip('ignored', 'item or automatic launch policy changed during recovery');
	const hold = automaticRequestHold(item, policy, now);
	if (hold) return skip('held', hold);
	if (item.launch?.token === request.token)
		return { result: { status: 'existing', intent: item.launch } };
	if (!matchesRecoveryIntent(item, request.expectedAuto) || hasOpenSession(snapshot, policy, now))
		return skip('conflict', 'item or session state changed during recovery');
	if (pendingIntent(item, snapshot)) return skip('conflict', 'launch is already pending');
	return queueRecovery(snapshot, { item, request }, policy, now);
}

function matchesRecoveryIntent(item: TrackerDispatchItem, expected: string | null) {
	return (item.launch?.token ?? null) === expected;
}

function recoveringItem(item: TrackerDispatchItem) {
	return item.status === 'in_progress' || item.launch?.source === 'recovery';
}

function queueRecovery(
	snapshot: TrackerDispatchSnapshot,
	{
		item,
		request
	}: { item: TrackerDispatchItem; request: Extract<TrackerLaunchRequest, { source: 'recovery' }> },
	policy: TrackerDispatchPolicy,
	now: number
): TrackerDispatchDecision {
	const target = canonicalNode(policy.node, policy);
	const pick = request.rung
		? { rung: request.rung, kind: item.kind, reason: 'resume on the same provider and model' }
		: policy.pickModel(item);
	if ('error' in pick) return skip('held', 'Tracker model cannot be selected for recovery');
	const intent = { source: 'recovery', target, token: request.token, scheduledPick: pick } as const;
	const hold = policy.admit(item, intent, pick.rung);
	if (
		hold &&
		/^(no approved Tracker repository or platform|no supported Tracker provider)/.test(hold)
	)
		return skip('held', hold);
	const run = queueRun(
		snapshot,
		{ item: { ...item, launch: intent }, token: intent.token, pick },
		policy,
		now
	);
	return {
		result: { status: 'requested', intent },
		writes: {
			item: { launch: intent, status: 'open' },
			runs: [{ ...run, failure_reason: hold }]
		}
	};
}

function pendingIntent(item: TrackerDispatchItem, { runs }: TrackerDispatchSnapshot) {
	const intent = item.launch;
	return intent && !runs.some((run) => run.auto_token === intent.token);
}

function unattendedTarget(
	item: TrackerDispatchItem,
	wanted: string,
	policy: TrackerDispatchPolicy
) {
	if (wanted === 'auto')
		return policy.chooseHost(item, { source: 'automatic', requestedNode: null });
	return knownNode(wanted, policy)
		? { node: canonicalNode(wanted, policy), why: '' }
		: { node: null, why: 'computer must be mac, mb2, box, auto, or a known tracker node' };
}
export function unattendedIntent(
	snapshot: TrackerDispatchSnapshot,
	request: Extract<TrackerLaunchRequest, { source: 'automatic' }> & {
		item: TrackerDispatchItem;
	},
	policy: TrackerDispatchPolicy,
	now: number
): TrackerDispatchDecision {
	const { item, token, unchangedSince } = request;
	const hold = automaticRequestHold(item, policy, now);
	if (hold) return skip('held', hold);
	if (!startable(item) || (item.updatedAt ?? Infinity) > unchangedSince)
		return skip('ignored', 'item changed while checking idle work');
	if (hasOpenSession(snapshot, policy, now) || pendingIntent(item, snapshot))
		return skip('conflict', 'item already has a session or a launch request');
	const wanted = (item.computer ?? 'auto').trim().toLowerCase() || 'auto';
	const target = unattendedTarget(item, wanted, policy);
	if (!target.node) return skip('held', target.why);
	const intent = {
		token,
		target: canonicalNode(target.node, policy),
		source: 'automatic'
	} as const;
	return {
		result: { status: 'requested', intent },
		writes: { item: { computer: intent.target, launch: intent } }
	};
}
