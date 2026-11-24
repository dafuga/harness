import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import type { TrackerListedRun } from '../../../repositories/projects-sessions/TrackerRunReadRepository.types';
import type { LaunchRequestState } from './launchRequestStatus.types';

export const launchWithdrawnReason = 'launch cancelled before startup';
export const launchLiveNotStopped =
	'auto-launch is off; no stop verb exists, so the live run keeps running';

/**
 * Derive the status of the item's launch request from the persisted request and its runs.
 * `runs` must be the item's runs in queue order (oldest first), as the run repository returns them.
 */
export function launchRequestStatus(
	item: TrackerItem,
	runs: TrackerListedRun[]
): LaunchRequestState | null {
	if (item.auto)
		return activeRequest(
			item,
			runs.filter((run) => run.auto_token === item.auto)
		);
	const latest = runs.at(-1);
	const live = runs.find(isLive);
	if (live)
		return {
			status: 'started',
			reason: launchLiveNotStopped,
			computer: live.node,
			attempt: live.attempt
		};
	if (latest?.state === 'finished' && latest.failure_reason === launchWithdrawnReason)
		return { status: 'withdrawn', reason: launchWithdrawnReason, attempt: latest.attempt };
	return null;
}

function activeRequest(item: TrackerItem, attempts: TrackerListedRun[]): LaunchRequestState | null {
	const newest = [...attempts].reverse();
	const live = newest.find(isLive);
	if (live) return { status: 'started', computer: live.node, attempt: live.attempt };
	const queued = newest.find((run) => run.state === 'queued');
	if (queued || !attempts.length) return pendingRequest(item, queued);
	return endedRequest(newest.find((run) => run.state === 'finished'));
}

function isLive(run: TrackerListedRun): boolean {
	return run.state !== 'finished' && Boolean(run.started_at);
}

function pendingRequest(item: TrackerItem, queued?: TrackerListedRun): LaunchRequestState {
	const computer = item.launch_target ?? queued?.node ?? item.computer;
	const hold = parseHold(item.launch_hold);
	return hold
		? { status: 'waiting', reason: hold, computer, attempt: queued?.attempt }
		: { status: 'queued', computer, attempt: queued?.attempt };
}

function endedRequest(failed?: TrackerListedRun): LaunchRequestState | null {
	if (failed?.outcome === 'done') return null;
	return {
		status: 'refused',
		reason: failed?.failure_reason ?? 'launch attempt ended before it started',
		computer: failed?.node,
		attempt: failed?.attempt
	};
}

function parseHold(raw: string | null | undefined): string | null {
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as { reason?: unknown };
		return typeof parsed.reason === 'string' ? parsed.reason : null;
	} catch {
		return null;
	}
}
