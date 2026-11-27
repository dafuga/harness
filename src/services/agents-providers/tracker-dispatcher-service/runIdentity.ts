// @harness-uid u_rzpjc6wqqy
import type {
	TrackerDispatchItem,
	TrackerDispatchPolicy,
	TrackerDispatchSnapshot,
	TrackerRunReceipt
} from '../TrackerDispatcherService.types';
import { canonicalNode, ownsLaunch, minute } from './launchEligibility';

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
