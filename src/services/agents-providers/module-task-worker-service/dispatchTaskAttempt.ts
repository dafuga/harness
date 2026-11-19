// @harness-uid u_ey34olghxx
import type {
	TaskExecution,
	TaskRunInput,
	TaskRunner,
	TaskUsage
} from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import { ModuleTaskAnalyticsService } from '../ModuleTaskAnalyticsService';
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
		const failure = error as {
			usage?: TaskUsage;
			reportedModel?: string | null;
			quotaRejected?: boolean;
		} | null;
		executions.push({
			...base,
			reportedModel: failure?.reportedModel ?? null,
			usage: failure?.usage,
			apiCost: analytics.quote(failure?.reportedModel ?? input.model, failure?.usage),
			status: 'failed',
			failureCause: rejectionCause(input.signal, failure?.quotaRejected === true),
			finishedAt: new Date().toISOString()
		});
		throw error;
	}
}

function rejectionCause(signal: AbortSignal, quota: boolean): TaskExecution['failureCause'] {
	if (signal.aborted) return signal.reason?.name === 'TimeoutError' ? 'timeout' : 'cancelled';
	return quota ? 'quota' : 'provider-error';
}
