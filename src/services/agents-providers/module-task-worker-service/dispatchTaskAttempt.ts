// @harness-uid u_ey34olghxx
import type {
	TaskExecution,
	TaskRunInput,
	TaskRunner,
	TaskSessionMetric,
	TaskUsage
} from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import { ModuleTaskAnalyticsService } from '../ModuleTaskAnalyticsService';
import type { TaskRunResult } from '../../../repositories/agents-providers/ModuleTaskRepository.types';
/** Keep every provider call, including failed or quota-rejected calls before fallback. */
export async function dispatchTaskAttempt(
	runner: TaskRunner,
	input: TaskRunInput,
	executions: TaskExecution[]
): Promise<TaskRunResult> {
	const startedAt = new Date().toISOString();
	const base = {
		provider: input.provider,
		model: input.model,
		intelligence: input.intelligence,
		startedAt
	};
	const analytics = new ModuleTaskAnalyticsService();
	try {
		const { sessions, ...result } = await runner.run(input);
		executions.push({
			...base,
			reportedModel: result.reportedModel,
			usage: result.usage,
			sessions,
			apiCost: analytics.quote(result.reportedModel ?? input.model, result.usage),
			status: 'succeeded',
			finishedAt: new Date().toISOString()
		});
		return result;
	} catch (error) {
		const failure = (error ?? {}) as {
			usage?: TaskUsage;
			sessions?: TaskSessionMetric[];
			reportedModel?: string | null;
			quotaRejected?: boolean;
		};
		executions.push({
			...base,
			reportedModel: failure.reportedModel ?? null,
			usage: failure.usage,
			sessions: failure.sessions,
			apiCost: analytics.quote(failure.reportedModel ?? input.model, failure.usage),
			status: 'failed',
			failureCause: rejectionCause(input.signal, failure.quotaRejected === true),
			finishedAt: new Date().toISOString()
		});
		throw error;
	}
}

function rejectionCause(signal: AbortSignal, quota: boolean): TaskExecution['failureCause'] {
	if (signal.aborted) return signal.reason?.name === 'TimeoutError' ? 'timeout' : 'cancelled';
	return quota ? 'quota' : 'provider-error';
}
