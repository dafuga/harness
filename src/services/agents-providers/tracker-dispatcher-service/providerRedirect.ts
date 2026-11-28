// @harness-uid u_rzpjc6wqqy
import type {
	TrackerDispatchItem,
	TrackerDispatchPolicy,
	TrackerLaunchPick,
	TrackerRunReceipt
} from '../TrackerDispatcherService.types';

/** A pick made earlier, replaced when the provider preference now rules its model out. */
export function currentPick(
	item: TrackerDispatchItem,
	pick: TrackerLaunchPick | { error: string },
	policy: TrackerDispatchPolicy
) {
	return ('error' in pick ? null : policy.redirectPick?.(item, pick.rung)) ?? pick;
}

/** The queued attempt records the model that actually starts and why it changed. */
export function redirectedRun(run: TrackerRunReceipt, pick: TrackerLaunchPick) {
	const { rung, reason } = pick;
	return {
		...run,
		rung: rung.id,
		cli: rung.cli,
		effort: rung.effort ?? null,
		pinned: Boolean(rung.pinned),
		reason
	};
}
