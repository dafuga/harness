// @harness-uid u_rzpjc6wqqy
import type {
	TrackerDispatchDecision,
	TrackerDispatchItem,
	TrackerDispatchPolicy,
	TrackerDispatchSnapshot,
	TrackerLaunchRequest
} from '../TrackerDispatcherService.types';
import {
	canonicalNode,
	hasOpenSession,
	skip,
	trackerFlagBlocksRecovery
} from './launchEligibility';

export function recoveryIntent(
	snapshot: TrackerDispatchSnapshot,
	{
		item,
		request
	}: { item: TrackerDispatchItem; request: Extract<TrackerLaunchRequest, { source: 'recovery' }> },
	policy: TrackerDispatchPolicy,
	now: number
): TrackerDispatchDecision {
	if (item.launch?.token === request.token)
		return { result: { status: 'existing', intent: item.launch } };
	if (
		!canRecover(item) ||
		(item.launch?.token ?? null) !== request.expectedAuto ||
		hasOpenSession(snapshot, policy, now)
	)
		return skip('conflict', 'item or session state changed during recovery');
	return admitRecovery(item, request, policy);
}

function admitRecovery(
	item: TrackerDispatchItem,
	request: Extract<TrackerLaunchRequest, { source: 'recovery' }>,
	policy: TrackerDispatchPolicy
): TrackerDispatchDecision {
	const target = canonicalNode(policy.node, policy);
	const pick = request.rung
		? { rung: request.rung, kind: item.kind, reason: 'resume on the same provider and model' }
		: policy.pickModel(item);
	if ('error' in pick) return skip('held', 'Tracker model cannot be selected for recovery');
	const intent = { source: 'recovery', target, token: request.token, scheduledPick: pick } as const;
	const hold =
		policy.enabled === false ? 'launcher disabled' : policy.admit(item, intent, pick.rung);
	return hold
		? skip('held', hold)
		: {
				result: { status: 'requested', intent },
				writes: { item: { launch: intent } }
			};
}
function canRecover(item: TrackerDispatchItem) {
	return (
		item.status === 'in_progress' &&
		item.kind === 'task' &&
		!item.recurring &&
		!(item.awaitingAnswer && trackerFlagBlocksRecovery(item.question))
	);
}
