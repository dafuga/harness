// @harness-uid u_rzpjc6wqqy
import type {
	TrackerDispatchItem,
	TrackerDispatchPolicy,
	TrackerLaunchRung,
	TrackerRetryAttempt
} from '../TrackerDispatcherService.types';

/**
 * A handoff resumes its model unless an explicit --model or the provider preference now rules
 * it out. A relaunch of a lost session climbs one rung.
 */
export function recoveryPick(
	item: TrackerDispatchItem,
	rung: TrackerLaunchRung | undefined,
	policy: TrackerDispatchPolicy
) {
	if (!rung) return policy.pickModel(item);
	if (rung.climbFrom) return climbedPick(item, rung.climbFrom, policy);
	return (
		policy.redirectPick?.(item, rung) ?? {
			rung,
			kind: item.kind,
			reason: 'resume on the same provider and model'
		}
	);
}

function climbedPick(
	item: TrackerDispatchItem,
	lost: TrackerRetryAttempt,
	policy: TrackerDispatchPolicy
) {
	const next = policy.retryModel(item, { ...lost, pinned: Boolean(lost.pinned) });
	if (!next) return policy.pickModel(item);
	const from = [lost.model, lost.effort].filter(Boolean).join(':');
	return {
		rung: next,
		kind: lost.kind ?? item.kind,
		reason: `watchdog relaunch after a lost ${from} session`
	};
}
