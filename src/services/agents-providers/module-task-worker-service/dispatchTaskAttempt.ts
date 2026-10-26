import type {
	TaskExecution,
	TaskRunInput,
	TaskRunner,
	TaskUsage
} from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import { ModuleTaskAnalyticsService } from '../ModuleTaskAnalyticsService';
import { taskPrelaunchNote } from '../../../repositories/agents-providers/module-task-repository/taskUsage';
/** Keep every provider call, including failed or quota-rejected calls before fallback. */
export async function dispatchTaskAttempt(
	runner: TaskRunner,
	input: TaskRunInput,
	executions: TaskExecution[]
) {
	const startedAt = new Date().toISOString();
	const base = {
		provider: input.provider,
		model: input.model,
		intelligence: input.intelligence,
		startedAt
	};
	const analytics = new ModuleTaskAnalyticsService();
	try {
		const result = await runner.run(input);
		executions.push({
			...base,
			reportedModel: result.reportedModel,
			usage: result.usage,
			apiCost: analytics.quote(result.reportedModel ?? input.model, result.usage),
			status: 'succeeded',
			finishedAt: new Date().toISOString()
		});
		return result;
	} catch (error) {
		const failure = taskFailure(error);
		const apiCost = analytics.quote(failure.reportedModel ?? input.model, failure.usage);
		executions.push({
			...base,
			reportedModel: failure.reportedModel,
			usage: failure.usage,
			apiCost: failure.blocked ? { ...apiCost, note: taskPrelaunchNote } : apiCost,
			status: 'failed',
			finishedAt: new Date().toISOString()
		});
		throw error;
	}
}

function taskFailure(error: unknown) {
	const failure = error as {
		usage?: TaskUsage;
		reportedModel?: string | null;
		diagnostic?: { phase?: string };
	};
	const blocked =
		failure?.diagnostic?.phase === 'prelaunch' && !failure.usage && !failure.reportedModel;
	return {
		usage: failure?.usage,
		reportedModel: failure?.reportedModel ?? null,
		blocked
	};
}
