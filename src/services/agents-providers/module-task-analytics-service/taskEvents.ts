import type { ModuleTask } from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import type { AnalyticsEvent } from '../../../core/reports-media/analyticsTypes';
import { fingerprint } from '../../../workflows/reports-media/analyticsRecord';
import { taskApiCost } from './taskPricing';
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
			apiCost: execution.apiCost
		}
	}));
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
function identity(task: ModuleTask, attempt: string) {
	return { attempt, feature: task.feature.id, module: task.module.id };
}

function executionsOf(result: NonNullable<ModuleTask['result']>) {
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
