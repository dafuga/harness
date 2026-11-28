// @harness-uid u_x665iye7um
import type {
	ModuleTask,
	TaskExecution
} from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import type { AnalyticsEvent } from '../../../core/reports-media/analyticsTypes';
import type { TaskAnalyticsDetail, TaskRunPosition } from '../ModuleTaskAnalyticsService.types';
import { fingerprint } from '../../../workflows/reports-media/analyticsRecord';
import { executionsOf } from './taskProviderExecutions';
import { taskSelection } from '../module-task-service/taskPrompt';
export function taskEvents(tasks: ModuleTask[], project: string): AnalyticsEvent[] {
	return tasks.flatMap((task) => [
		...executionEvents(task, project),
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
				reportedModel: review.reportedModel,
				rejectionCause: review.cause
			}
		}))
	]);
}

function executionEvents(task: ModuleTask, project: string): AnalyticsEvent[] {
	const results = [...task.attempts, ...(task.result ? [task.result] : [])];
	const claims = [...task.claimHistory, ...(task.claim ? [task.claim] : [])];
	const positions = new Map(claims.map((claim, index) => [claim.token, index]));
	let priorEscalations = 0;
	let nextClaim = 0;
	const events: AnalyticsEvent[] = [];
	for (const [index, result] of results.entries()) {
		const claimIndex = result.attempt ? (positions.get(result.attempt) ?? index) : index;
		events.push(
			...abandonedEvents(task, project, { start: nextClaim, end: claimIndex, priorEscalations }),
			...submissionEvents(
				task,
				result,
				{
					attemptNumber: claimIndex + 1,
					priorEscalations,
					startedAt: claims[claimIndex]?.startedAt
				},
				project
			)
		);
		priorEscalations += Math.max(0, executionsOf(result).length - 1);
		nextClaim = Math.max(nextClaim, claimIndex + 1);
	}
	events.push(...abandonedEvents(task, project, { start: nextClaim, priorEscalations }));
	return events;
}

function abandonedEvents(
	task: ModuleTask,
	project: string,
	range: { start: number; end?: number; priorEscalations: number }
): AnalyticsEvent[] {
	return task.claimHistory.slice(range.start, range.end).flatMap((claim, index) => {
		if (!claim.recoveredAt) return [];
		const position = {
			attemptNumber: range.start + index + 1,
			priorEscalations: range.priorEscalations
		};
		return [abandonedEvent(task, claim, position, project)];
	});
}

function abandonedEvent(
	task: ModuleTask,
	claim: NonNullable<ModuleTask['claim']>,
	position: TaskRunPosition,
	project: string
): AnalyticsEvent {
	return {
		id: fingerprint([project, task.id, claim.token, 'abandoned']),
		timestamp: claim.recoveredAt!,
		project,
		task: task.id,
		kind: 'task',
		action: 'abandoned',
		status: 'failed',
		requestedModel: task.model,
		moduleTask: {
			...identity(task, claim.token),
			...taskSelection(task),
			reportedModel: null,
			run: {
				...jobDetails(task, position),
				executionNumber: 1,
				startedAt: null,
				filesTouched: null,
				linesChanged: null,
				failureCause: 'abandoned'
			}
		}
	};
}

function submissionEvents(
	task: ModuleTask,
	result: NonNullable<ModuleTask['result']>,
	position: TaskRunPosition,
	project: string
): AnalyticsEvent[] {
	const attempt = result.attempt ?? `legacy-${position.attemptNumber - 1}-${result.finishedAt}`;
	const base = { project, task: task.id, kind: 'task' as const, requestedModel: task.model };
	const executions = executionsOf(result);
	const job = jobDetails(task, position);
	const events: AnalyticsEvent[] = executions.map((execution, slot) => {
		const last = slot === executions.length - 1;
		return {
			...base,
			id: fingerprint([project, task.id, attempt, 'executed', slot]),
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
				run: runDetails(job, execution, {
					number: slot + 1,
					startedAt: position.startedAt,
					result: last ? result : undefined
				})
			}
		};
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
	return events;
}
function jobDetails(task: ModuleTask, position: TaskRunPosition) {
	return {
		taskType: task.taskType ?? 'module',
		estimatedDifficulty: task.estimatedDifficulty ?? null,
		attemptNumber: position.attemptNumber,
		priorEscalations: position.priorEscalations
	};
}

function runDetails(
	job: Pick<
		NonNullable<TaskAnalyticsDetail['run']>,
		'taskType' | 'estimatedDifficulty' | 'attemptNumber' | 'priorEscalations'
	>,
	execution: Omit<TaskExecution, 'startedAt'> & { startedAt?: string },
	final: { number: number; startedAt?: string; result?: ModuleTask['result'] }
): NonNullable<TaskAnalyticsDetail['run']> {
	const measured = resultDetails(final.result, execution.status);
	return {
		...job,
		...measured,
		executionNumber: final.number,
		startedAt: execution.startedAt ?? final.startedAt ?? null,
		failureCause: execution.failureCause ?? measured.failureCause
	};
}

function identity(task: ModuleTask, attempt: string) {
	return { attempt, feature: task.feature.id, module: task.module.id };
}
function resultDetails(result: ModuleTask['result'], status: TaskExecution['status']) {
	return {
		filesTouched: result && !result.error ? result.changedFiles.length : null,
		linesChanged: result?.changedLines ?? null,
		failureCause:
			result?.failureCause ?? (result?.error && status === 'succeeded' ? 'workspace-error' : null)
	};
}
