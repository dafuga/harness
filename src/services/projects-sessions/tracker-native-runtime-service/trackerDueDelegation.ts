// @harness-uid u_bl6xl2h4a3
import {
	automaticQuietHour,
	automaticRequestHold,
	canonicalNode,
	dueOwner
} from '../../agents-providers/tracker-dispatcher-service/launchEligibility';
import type {
	TrackerDispatchItem,
	TrackerDispatchPolicy,
	TrackerDispatchSnapshot,
	TrackerDuePolicy,
	TrackerLaunchIntent
} from '../../agents-providers/TrackerDispatcherService.types';

/** Whether the hub may let `target` start the due launch it requested. */
export function grantsDelegation(
	snapshot: TrackerDispatchSnapshot,
	{ token, target }: { token: string; target: string },
	policy: TrackerDispatchPolicy
) {
	const { item, due, runs } = snapshot;
	const now = policy.now();
	if (!item || !due || due.paused || automaticQuietHour(now)) return false;
	if (!mayDelegate(item, { due, target }, policy) || automaticRequestHold(item, policy, now))
		return false;
	return (
		matchingDelegation(item.launch, { token, target }) &&
		!runs.some((run) => run.auto_token === token && run.node !== target)
	);
}

/** Adapter intake is delegated by its owning hub; other due work runs only on its own computer. */
function mayDelegate(
	item: TrackerDispatchItem,
	{ due, target }: { due: TrackerDuePolicy; target: string },
	policy: TrackerDispatchPolicy
) {
	if (item.adapterDueOwner)
		return due.adapterDue === true && canonicalNode(item.adapterDueOwner, policy) === policy.node;
	return due.enabled && dueOwner(item, due, policy) === canonicalNode(target, policy);
}

function matchingDelegation(
	intent: TrackerLaunchIntent | null | undefined,
	{ token, target }: { token: string; target: string }
) {
	return intent?.source === 'due' && intent.token === token && intent.target === target;
}
