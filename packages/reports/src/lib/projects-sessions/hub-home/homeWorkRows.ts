// @harness-uid u_ycw5brow23
import { isoTime } from '../project-overview/projectOverviewItems';
import type {
	TrackerItemRecord,
	TrackerRunRecord
} from '../project-overview/projectOverviewTracker.types';
import type { HomeWorkRow, HomeWorkState, ItemWork } from './homeLive.types';
import { homeText } from './homeTrackerText';
import { homeWorkNow } from './homeWorkNow';

const at = (time: number | null | undefined) => (time ? new Date(time).toISOString() : null);

/** The model and effort a run used. */
function runModel(run: TrackerRunRecord | undefined) {
	if (!run?.model) return null;
	return run.effort ? `${run.model}:${run.effort}` : run.model;
}

/** What a run records about itself; without a run, what the item asks for. */
function runFacts(item: TrackerItemRecord, run: Partial<TrackerRunRecord> = {}) {
	return {
		outcome: homeText(run.outcome, 200),
		computer: homeText(run.node ?? item.computer, 200),
		startedAt: at(run.started_at ?? run.queued_at)
	};
}

/** @pure One row of an item, from a run when it has one. */
export function workRow(
	work: ItemWork,
	state: HomeWorkState,
	run?: TrackerRunRecord
): HomeWorkRow {
	const { item } = work;
	return {
		key: run ? `run:${run.node ?? ''}:${run.id}` : `item:${item.id}`,
		itemId: item.id,
		...(run && { runId: run.id }),
		title: homeText(item.title, 500) ?? 'Untitled task',
		state,
		status: item.status,
		stage: item.stage ?? null,
		now: state === 'queued' ? queuedReason(run) : homeWorkNow(item),
		owner: homeText(item.owner, 200),
		model: homeText(runModel(run) ?? item.model, 200),
		updatedAt: isoTime(item.updated_at),
		...runFacts(item, run)
	};
}

/** @pure Why a queued run has not started. */
export function queuedReason(run?: TrackerRunRecord) {
	if (run?.failure_reason === 'Tracker host is at session capacity') return 'Waiting for a slot';
	return homeText(run?.failure_reason, 240) ?? 'Waiting to start';
}
