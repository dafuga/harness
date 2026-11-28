// @harness-uid u_rzpjc6wqqy
import type {
	TrackerDispatchItem,
	TrackerDispatchPolicy,
	TrackerDispatchSnapshot,
	TrackerLaunchSource,
	TrackerRunReceipt
} from '../TrackerDispatcherService.types';
import { canonicalNode, ownsLaunch, minute } from './launchEligibility';

/** Recovery can continue before a deadline when this host has an observed start for the item. */
export function continuesStartedRun(
	source: TrackerLaunchSource,
	runs: readonly Pick<TrackerRunReceipt, 'node' | 'started_at'>[],
	policy: Pick<TrackerDispatchPolicy, 'node' | 'resolveHost'>
) {
	const host = canonicalNode(policy.node, policy);
	return (
		source === 'recovery' &&
		runs.some(({ node, started_at }) => node === host && started_at !== null)
	);
}

export function activeRun(run: TrackerRunReceipt, policy: TrackerDispatchPolicy, now: number) {
	if (run.state === 'finished') return false;
	if (run.node === canonicalNode(policy.node, policy)) return true;
	const touched = run.resumed_at ?? run.started_at ?? run.queued_at;
	return now - touched <= (policy.maxRunMinutes ?? 480) * minute;
}

export function hasOpenSession(
	snapshot: TrackerDispatchSnapshot,
	policy: TrackerDispatchPolicy,
	now: number,
	except?: TrackerRunReceipt
) {
	return (
		snapshot.openSession === true ||
		snapshot.activeSessionKeys?.some((key) => !except || key !== attemptKey(except)) === true ||
		snapshot.runs.some((run) => run !== except && activeRun(run, policy, now))
	);
}

export function attemptKey(run: TrackerRunReceipt): string {
	return JSON.stringify([run.item_id, run.auto_token, run.attempt]);
}

export function matchesRequest(
	item: TrackerDispatchItem | null,
	run: TrackerRunReceipt,
	policy: TrackerDispatchPolicy
) {
	return Boolean(item?.launch?.token === run.auto_token && ownsLaunch(item.launch, policy));
}
