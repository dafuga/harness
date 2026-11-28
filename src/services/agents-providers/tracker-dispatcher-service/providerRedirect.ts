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

/** A queued attempt records the model that actually starts and why it changed. */
export function retryStart<
	Run extends TrackerRunReceipt & { cli: TrackerLaunchPick['rung']['cli'] }
>(item: TrackerDispatchItem, run: Run, policy: TrackerDispatchPolicy) {
	const { cli, model, effort, pinned } = run;
	const redirected = policy.redirectPick?.(item, run);
	if (!redirected) return { rung: { id: run.rung, cli, model, effort, pinned }, next: run };
	const { rung, reason } = redirected;
	const next = {
		...run,
		rung: rung.id,
		cli: rung.cli,
		model: rung.model,
		effort: rung.effort ?? null,
		pinned: Boolean(rung.pinned),
		reason
	};
	return { rung, next };
}
