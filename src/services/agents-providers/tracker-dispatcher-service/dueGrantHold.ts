// @harness-uid u_rzpjc6wqqy
import type {
	TrackerDispatchItem,
	TrackerDispatchPolicy,
	TrackerDispatchSnapshot,
	TrackerDueGrant,
	TrackerLaunchIntent
} from '../TrackerDispatcherService.types';
import { canonicalNode, mayScheduleHere } from './launchEligibility';

export function dueGrantHold(
	snapshot: TrackerDispatchSnapshot,
	{
		item,
		intent,
		grant
	}: { item: TrackerDispatchItem; intent: TrackerLaunchIntent; grant?: TrackerDueGrant },
	policy: TrackerDispatchPolicy,
	now: number
): string | null {
	const { due, lastDueStartAt } = snapshot;
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
	if (acceptsDelegatedGrant(item, grant, policy)) return null;
	return acceptsGrant(grant, canSchedule, Boolean(item.adapterDueOwner))
		? null
		: 'waiting for the hub to authorize due launch';
}

function acceptsDelegatedGrant(
	item: TrackerDispatchItem,
	grant: TrackerDueGrant,
	policy: TrackerDispatchPolicy
) {
	return (
		policy.allowDelegatedAdapterDue &&
		grant.decision === 'granted' &&
		item.adapterDueOwner &&
		canonicalNode(item.adapterDueOwner, policy) !== canonicalNode(policy.node, policy)
	);
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
