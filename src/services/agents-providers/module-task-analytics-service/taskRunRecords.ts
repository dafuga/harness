// @harness-uid u_kmgnftmwsz
import type { AnalyticsEvent } from '../../../core/reports-media/analyticsTypes';
import { createHash } from 'node:crypto';
import type { TaskAnalyticsDetail } from '../ModuleTaskAnalyticsService.types';
import { createRunRecord } from './modelRunRecord';
import type { RunRecord, RunOutcome } from './modelRunRecord.types';

/** Join review facts before applying the execution-side report filters. */
export function taskRunRecords(history: AnalyticsEvent[], selected: AnalyticsEvent[]): RunRecord[] {
	const { reviews, firstReject } = taskReviews(history);
	const runs = new Map<string, RunRecord>();
	for (const event of selected) {
		if (
			event.kind !== 'task' ||
			!['executed', 'abandoned'].includes(event.action) ||
			!event.moduleTask ||
			!event.task
		)
			continue;
		runs.set(
			event.id,
			moduleRunRecord(event, event.moduleTask, {
				current: reviews.get(attemptKey(event)),
				firstReject: firstReject.get(taskKey(event))
			})
		);
	}
	return [...runs.values()].sort(
		(a, b) =>
			a.finishedAt.localeCompare(b.finishedAt) ||
			(a.attempt ?? 0) - (b.attempt ?? 0) ||
			a.id.localeCompare(b.id)
	);
}

function taskReviews(history: AnalyticsEvent[]) {
	const reviews = new Map<string, AnalyticsEvent>();
	const firstReject = new Map<string, AnalyticsEvent>();
	for (const event of history) {
		if (event.kind !== 'task' || !['accepted', 'incomplete'].includes(event.action)) continue;
		reviews.set(attemptKey(event), event);
		const key = taskKey(event);
		const previous = firstReject.get(key);
		if (event.action === 'incomplete' && (!previous || event.timestamp < previous.timestamp))
			firstReject.set(key, event);
	}
	return { reviews, firstReject };
}

function taskKey(event: AnalyticsEvent): string {
	return JSON.stringify([event.project, event.task]);
}

function attemptKey(event: AnalyticsEvent): string {
	return JSON.stringify([event.project, event.task, event.moduleTask?.attempt]);
}

function moduleRunRecord(
	event: AnalyticsEvent,
	detail: TaskAnalyticsDetail,
	review: { current?: AnalyticsEvent; firstReject?: AnalyticsEvent }
): RunRecord {
	const run = detail.run;
	const outcome = executionOutcome(event, run?.failureCause, review.current?.action);
	const rejectionCause =
		outcome === 'rejected' ? review.current?.moduleTask?.rejectionCause : run?.failureCause;
	return createRunRecord({
		...runContext(run),
		source: 'harness',
		id: event.id,
		taskId: event.task!,
		chainId: createHash('sha256').update(taskKey(event)).digest('hex'),
		project: event.project,
		moduleId: detail.module,
		provider: detail.provider,
		model: detail.reportedModel ?? detail.model,
		effort: detail.intelligence,
		finishedAt: event.timestamp,
		outcome,
		rejectionCause,
		rejectedBefore: rejectedEarlier(event, review.firstReject),
		danielCorrections: rejectionCause === 'user-correction' ? 1 : null,
		usage: detail.usage,
		cost: detail.apiCost
	});
}

function rejectedEarlier(event: AnalyticsEvent, rejection?: AnalyticsEvent): boolean | null {
	if (!event.moduleTask?.run) return null;
	return Boolean(
		rejection &&
		rejection.timestamp <= event.timestamp &&
		attemptKey(rejection) !== attemptKey(event)
	);
}

function runContext(run: TaskAnalyticsDetail['run']) {
	if (!run) return { taskType: 'module', attempt: null };
	const escalations = run.priorEscalations + run.executionNumber - 1;
	return {
		taskType: run.taskType,
		attempt: run.attemptNumber + escalations,
		escalations,
		startedAt: run.startedAt,
		estimatedDifficulty: run.estimatedDifficulty,
		filesTouched: run.filesTouched,
		linesChanged: run.linesChanged
	};
}

function executionOutcome(
	event: AnalyticsEvent,
	failureCause: string | null | undefined,
	review: string | undefined
): RunOutcome {
	if (failureCause === 'timeout') return 'timed_out';
	if (failureCause === 'cancelled' || failureCause === 'abandoned') return 'abandoned';
	if (
		event.status === 'failed' ||
		['workspace-error', 'scope', 'check'].includes(failureCause ?? '')
	)
		return 'failed';
	if (review === 'accepted') return 'done';
	if (review === 'incomplete') return 'rejected';
	return 'pending_review';
}
