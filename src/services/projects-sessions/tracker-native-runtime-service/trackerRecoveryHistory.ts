// @harness-uid u_bl6xl2h4a3
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import type { TrackerListedRun } from '../../../repositories/projects-sessions/TrackerRunReadRepository.types';
import type { TrackerLaunchRung } from '../../agents-providers/TrackerDispatcherService.types';
import { handLaunchNode, handLaunchSelection } from './trackerHandLaunchSelection';
import { sessionHealthInterval } from './trackerSessionHealth';
import type { TrackerRecoveryState } from './trackerSessionRecovery.types';

export function resetBudget(
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
	return (
		run.ended_at - start >= sessionHealthInterval ||
		item.notes_log.some(
			({ node, at, text }) =>
				node === run.node &&
				Date.parse(at) >= start &&
				/^stopped: watchdog context handoff; resume from:/i.test(text)
		)
	);
}

export function recoveryRung(
	run: TrackerListedRun | undefined,
	item: TrackerItem,
	node: string
): TrackerLaunchRung | undefined {
	const fallback = handLaunchSelection(item, node);
	if (fallback && handLaunchNode(item, run?.started_at ?? 0) === node) return fallback;
	const recorded = run && recordedRung(run);
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
