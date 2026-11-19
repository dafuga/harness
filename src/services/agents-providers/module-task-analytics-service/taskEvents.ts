// @harness-uid u_x665iye7um
import type { ModuleTask } from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import type { AnalyticsEvent } from '../../../core/reports-media/analyticsTypes';
import { fingerprint } from '../../../workflows/reports-media/analyticsRecord';
import { taskApiCost } from './taskPricing';
import { classifyTaskType, createRunRecord, difficultyForFiles } from './model-analytics.mjs';
import type {
	TaskAnalyticsExecution,
	TaskAnalyticsReview,
	TaskRunProgress
} from '../ModuleTaskAnalyticsService.types';
export function taskEvents(tasks: ModuleTask[], project: string): AnalyticsEvent[] {
	return tasks.flatMap((task) => {
		const progress: TaskRunProgress = {
			attempt: 0,
			escalations: 0,
			previous: null,
			rejectedBefore: false
		};
		return [
			...[...task.attempts, ...(task.result ? [task.result] : [])].flatMap((result, index) =>
				submissionEvents({ task, result, index, project }, progress)
			),
			...task.reviews.map((review) => ({
				id: fingerprint([project, task.id, review.attempt, review.verdict]),
				timestamp: review.at,
				project,
				task: task.id,
				kind: 'task' as const,
				action: review.verdict,
				agentModel: review.reportedModel ?? undefined,
				requestedModel: task.model,
				moduleTask: {
					...identity(task, review.attempt),
					provider: review.provider,
					model: review.model,
					intelligence: review.intelligence,
					reportedModel: review.reportedModel
				}
			}))
		];
	});
}
function submissionEvents(
	{
		task,
		result,
		index,
		project
	}: {
		task: ModuleTask;
		result: NonNullable<ModuleTask['result']>;
		index: number;
		project: string;
	},
	progress: TaskRunProgress
): AnalyticsEvent[] {
	const attempt = result.attempt ?? `legacy-${index}-${result.finishedAt}`;
	const base = { project, task: task.id, kind: 'task' as const, requestedModel: task.model };
	const executions = executionsOf(result);
	const review = task.reviews.find((entry) => entry.attempt === attempt);
	const events: AnalyticsEvent[] = executions.map((execution, slot) => {
		const id = fingerprint([project, task.id, attempt, 'executed', slot]);
		const last = slot === executions.length - 1;
		const modelRun = executionRecord(
			{
				task,
				project,
				id,
				execution,
				submitted: last && !result.error && execution.status === 'succeeded',
				review,
				filesTouched: last && !result.error ? result.changedFiles.length : null
			},
			progress
		);
		return executionEvent({ base, id, task, attempt, execution, modelRun });
	});
	if (!result.error)
		events.push({
			...base,
			id: fingerprint([project, task.id, attempt, 'submitted']),
			timestamp: result.finishedAt,
			action: 'submitted',
			agentModel: result.reportedModel ?? undefined,
			moduleTask: {
				...identity(task, attempt),
				provider: result.provider,
				model: result.model,
				intelligence: result.intelligence,
				reportedModel: result.reportedModel
			}
		});
	progress.rejectedBefore ||= review?.verdict === 'incomplete';
	return events;
}
function executionEvent({
	base,
	id,
	task,
	attempt,
	execution,
	modelRun
}: {
	base: { project: string; task: string; kind: 'task'; requestedModel: string };
	id: string;
	task: ModuleTask;
	attempt: string;
	execution: TaskAnalyticsExecution;
	modelRun: ReturnType<typeof createRunRecord>;
}): AnalyticsEvent {
	return {
		...base,
		id,
		timestamp: execution.finishedAt,
		action: 'executed',
		status: execution.status,
		agentModel: execution.reportedModel ?? undefined,
		moduleTask: {
			...identity(task, attempt),
			provider: execution.provider,
			model: execution.model,
			intelligence: execution.intelligence,
			reportedModel: execution.reportedModel,
			usage: execution.usage,
			apiCost: execution.apiCost,
			modelRun
		}
	};
}
function executionRecord(
	{
		task,
		project,
		id,
		execution,
		submitted,
		review,
		filesTouched
	}: {
		task: ModuleTask;
		project: string;
		id: string;
		execution: TaskAnalyticsExecution;
		submitted: boolean;
		review?: TaskAnalyticsReview;
		filesTouched: number | null;
	},
	progress: TaskRunProgress
) {
	const model = execution.reportedModel ?? execution.model;
	const selection = JSON.stringify([execution.provider, execution.model, execution.intelligence]);
	progress.attempt++;
	if (progress.previous !== null && progress.previous !== selection) progress.escalations++;
	progress.previous = selection;
	return createRunRecord({
		source: 'harness',
		id: `harness:${id}`,
		taskId: task.id,
		chainId: task.id,
		project,
		taskType: classifyTaskType(task.title, undefined, 'module'),
		provider: execution.provider,
		model,
		effort: execution.intelligence,
		startedAt: execution.startedAt,
		finishedAt: execution.finishedAt,
		outcome: runOutcome(submitted, review),
		attempt: progress.attempt,
		escalations: progress.escalations,
		estimatedDifficulty: difficultyForFiles(task.module.files.length),
		filesTouched,
		danielCorrections: Number(
			submitted &&
				review?.verdict === 'incomplete' &&
				/^daniel(?:\s*fug[eè]re)?$/iu.test(review.reviewer.trim())
		),
		rejectedBefore: progress.rejectedBefore,
		usage: execution.usage,
		cost: execution.apiCost,
		actualUsd: execution.usage?.actualUsd,
		codexCredits: execution.usage?.codexCredits
	});
}
function runOutcome(submitted: boolean, review?: TaskAnalyticsReview) {
	if (!submitted) return 'failed';
	if (review?.verdict === 'accepted') return 'done';
	if (review?.verdict === 'incomplete') return 'rejected';
	return 'pending_review';
}
function identity(task: ModuleTask, attempt: string) {
	return { attempt, feature: task.feature.id, module: task.module.id };
}

function executionsOf(result: NonNullable<ModuleTask['result']>): TaskAnalyticsExecution[] {
	return result.executions.length
		? result.executions
		: [
				{
					provider: result.provider,
					model: result.model,
					intelligence: result.intelligence,
					reportedModel: result.reportedModel,
					usage: result.usage,
					apiCost: taskApiCost(result.reportedModel ?? result.model, result.usage),
					status: result.error ? 'failed' : 'succeeded',
					finishedAt: result.finishedAt
				}
			];
}
