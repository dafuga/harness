import type { ModuleTask } from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import type { AnalyticsEvent } from '../../../core/reports-media/analyticsTypes';
import { fingerprint } from '../../../workflows/reports-media/analyticsRecord';
import { taskApiCost } from './taskPricing';
import { taskPrelaunchNote } from '../../../repositories/agents-providers/module-task-repository/taskUsage';
export function taskEvents(tasks: ModuleTask[], project: string): AnalyticsEvent[] {
	return tasks.flatMap((task) => [
		...[...task.attempts, ...(task.result ? [task.result] : [])].flatMap((result, index) =>
			submissionEvents(task, result, index, project)
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
	]);
}
function submissionEvents(
	task: ModuleTask,
	result: NonNullable<ModuleTask['result']>,
	index: number,
	project: string
): AnalyticsEvent[] {
	const attempt = result.attempt ?? `legacy-${index}-${result.finishedAt}`;
	const base = { project, task: task.id, kind: 'task' as const, requestedModel: task.model };
	const executions = executionsOf(result);
	const events: AnalyticsEvent[] = executions.map((execution, slot) => ({
		...base,
		id: fingerprint([project, task.id, attempt, 'executed', slot]),
		timestamp: execution.finishedAt,
		action: executionAction(result, execution, slot),
		status: execution.status,
		agentModel: execution.reportedModel ?? undefined,
		moduleTask: {
			...identity(task, attempt),
			provider: execution.provider,
			model: execution.model,
			intelligence: execution.intelligence,
			reportedModel: execution.reportedModel,
			usage: execution.usage,
			apiCost: execution.apiCost
		}
	}));
	if (!executions.length) events.push(missingExecution(task, result, project, attempt));
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
function missingExecution(
	task: ModuleTask,
	result: NonNullable<ModuleTask['result']>,
	project: string,
	attempt: string
): AnalyticsEvent {
	return {
		project,
		task: task.id,
		kind: 'task',
		requestedModel: task.model,
		id: fingerprint([project, task.id, attempt, 'executed', 0]),
		timestamp: result.finishedAt,
		action: result.attempt && result.error ? 'prelaunch-failed' : 'execution-unknown',
		status: result.error ? 'failed' : 'unknown',
		agentModel: result.reportedModel ?? undefined,
		moduleTask: {
			...identity(task, attempt),
			provider: result.provider,
			model: result.model,
			intelligence: result.intelligence,
			reportedModel: result.reportedModel
		}
	};
}
function identity(task: ModuleTask, attempt: string) {
	return { attempt, feature: task.feature.id, module: task.module.id };
}

function executionAction(
	result: NonNullable<ModuleTask['result']>,
	execution: Pick<
		NonNullable<ModuleTask['result']>['executions'][number],
		'status' | 'usage' | 'reportedModel' | 'apiCost'
	>,
	slot: number
) {
	const oldPrelaunch = [
		'Provider launch was blocked before execution.',
		'Task could not start because resource admission failed.',
		'Task CLI could not be started.'
	].includes(result.error ?? '');
	const noProviderEvidence = !execution.usage && !execution.reportedModel;
	const failed = execution.status === 'failed';
	const provenOldFailure = [
		oldPrelaunch,
		slot === result.executions.length - 1,
		failed,
		noProviderEvidence
	].every(Boolean);
	const marked = [failed, execution.apiCost.note === taskPrelaunchNote, noProviderEvidence].every(
		Boolean
	);
	return marked || provenOldFailure ? 'prelaunch-failed' : 'executed';
}

function executionsOf(result: NonNullable<ModuleTask['result']>) {
	if (result.executions.length) return result.executions;
	if (result.attempt || result.error) return [];
	return [
		{
			provider: result.provider,
			model: result.model,
			intelligence: result.intelligence,
			reportedModel: result.reportedModel,
			usage: result.usage,
			apiCost: taskApiCost(result.reportedModel ?? result.model, result.usage),
			status: 'succeeded' as const,
			finishedAt: result.finishedAt
		}
	];
}
