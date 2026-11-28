// @harness-uid u_bl6xl2h4a3
import { trackerResourceHoldPrefix } from '../../../utils/projects-sessions/trackerHostResourceHold';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { trackerHostCapacityHold } from './trackerHostAdmission';
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import type { TrackerListedRun } from '../../../repositories/projects-sessions/TrackerRunReadRepository.types';
import type { TrackerLaunchRung } from '../../agents-providers/TrackerDispatcherService.types';
import { handLaunchNode, handLaunchSelection } from './trackerHandLaunchSelection';
import { recoveryGrace } from '../watchdog-recovery-service/watchdogRecoverySessions';
import {
	finalReportHold,
	trackerFlagBlocksRecovery
} from '../../agents-providers/tracker-dispatcher-service/launchEligibility';
import { trackerStoredSchedulingHold } from '../../../repositories/projects-sessions/tracker-dispatch-repository/dispatchItemFields';
import type { TrackerRecoveryState } from './trackerSessionRecovery.types';
import { trackerContextCheckpointPrefix } from './trackerWatchdogContext';

export const maxRecoveryAttempts = 3;
export const emptyRecoveryState: TrackerRecoveryState = {
	token: null,
	requestedAt: 0,
	retryAt: 0,
	failures: []
};

export function recoveryBudget(
	store: TrackerPersistenceService,
	{ key, latest, item }: { key: string; latest?: TrackerListedRun; item: TrackerItem }
): TrackerRecoveryState {
	const stored = JSON.parse(store.getMeta(key) ?? 'null') as TrackerRecoveryState | null;
	const exhausted = stored?.failures.length === maxRecoveryAttempts;
	// Unblocking the held item is how Chief of Staff allows another attempt.
	const cleared = item.status !== 'blocked';
	if (!stored || (exhausted && cleared) || resetBudget(stored, latest, item))
		return emptyRecoveryState;
	return {
		...stored,
		failures: stored.failures.filter((reason) => !hostWait(reason))
	};
}

/** A busy or short computer delays recovery without spending a relaunch attempt. */
export function hostWait(reason: string) {
	return reason === trackerHostCapacityHold || reason.startsWith(trackerResourceHoldPrefix);
}

function resetBudget(
	state: TrackerRecoveryState | null,
	run: TrackerListedRun | undefined,
	item: TrackerItem
) {
	if (!state) return false;
	if (run?.queued_at == null || run.queued_at < state.requestedAt) return false;
	if (run.auto_token !== (state.token ?? state.lastToken)) return run.queued_at > state.requestedAt;
	return settledRecoveryRun(run, item);
}

function settledRecoveryRun(run: TrackerListedRun, item: TrackerItem) {
	if (run.started_at == null || run.ended_at == null) return false;
	const start = Math.max(run.started_at, run.queued_at ?? 0);
	return run.ended_at - start >= recoveryGrace || hasContextCheckpoint(run, item);
}

function hasContextCheckpoint(run: TrackerListedRun, item: TrackerItem): boolean {
	const start = Math.max(run.resumed_at ?? run.started_at ?? 0, run.queued_at ?? 0);
	return item.notes_log.some(
		({ node, at, text }) =>
			node === run.node &&
			Date.parse(at) >= start &&
			Date.parse(at) <= (run.ended_at ?? Infinity) &&
			text.toLowerCase().startsWith(trackerContextCheckpointPrefix)
	);
}

export function recoveryRung(
	run: TrackerListedRun | undefined,
	item: TrackerItem,
	node: string
): TrackerLaunchRung | undefined {
	const recorded = run && recordedRung(run);
	if (recorded && run && hasContextCheckpoint(run, item)) return recorded;
	const fallback = handLaunchSelection(item, node);
	if (fallback && handLaunchNode(item, run?.started_at ?? 0) === node) return fallback;
	return recorded ?? compatibleFallback(run, fallback);
}

function compatibleFallback(run?: TrackerListedRun, fallback?: TrackerLaunchRung) {
	return !run || run.cli === 'none' || fallback?.cli === run.cli ? fallback : undefined;
}

function recordedRung(run: TrackerListedRun): TrackerLaunchRung | undefined {
	if (run.cli !== 'codex' && run.cli !== 'claude') return undefined;
	if (!/^[a-z0-9][a-z0-9._-]{1,79}$/i.test(run.model) || run.model === 'unknown') return undefined;
	return { id: run.rung, cli: run.cli, model: run.model, effort: run.effort, pinned: true };
}
export function recoveryHold(
	item: TrackerItem,
	latest: TrackerListedRun | undefined,
	{ changedAt, now }: { changedAt: number; now: number }
) {
	const stored = trackerStoredSchedulingHold(item, now);
	if (item.needs_daniel && !item.resolved && trackerFlagBlocksRecovery(item.question))
		return item.question ?? 'Waiting on Daniel';
	if (!latest) return stored;
	if (latest.failure_reason === 'stopped by operator' && item.schedule_off)
		return latest.failure_reason;
	if (stored) return stored;
	return previousRunHold(latest, changedAt, item.answered_at);
}

function previousRunHold(latest: TrackerListedRun, changedAt: number, answeredAt: string | null) {
	const authorized = Math.max(changedAt, Date.parse(answeredAt ?? '') || 0);
	if (latest.outcome === 'blocked' && authorized < (latest.ended_at ?? 0))
		return latest.failure_reason ?? 'The previous run was blocked';
	return finalReportHold(latest, authorized);
}

export function hasRecoveryBrief(item: TrackerItem, latest?: TrackerListedRun) {
	if (!item.title) return false;
	return (
		[item.notes, item.adapter_instructions, latest, item.auto].some(Boolean) ||
		item.notes_log.some(({ text }) => /^stopped:|\b(?:hand|manually)[ -]launched\b/i.test(text))
	);
}
