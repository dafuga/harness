// @harness-uid u_rw64iex44n
import type { TaskRunInput } from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import { estimateApiCost } from '../../../services/agents-providers/module-task-analytics-service/modelRunPricing';
import { ModuleTaskRunError } from '../ModuleTaskRunnerAdapter.types';
import type { TaskProcessResult, TaskPublicEvent } from '../ModuleTaskRunnerAdapter.types';
import type {
	CompleteGeneration,
	GenerationResult,
	LaunchGeneration
} from './managedTaskSessions.types';
import { taskUsage } from './taskUsage';
import { hardContextTokens } from './sessionPolicy';

export async function runGeneration(
	input: TaskRunInput,
	launch: LaunchGeneration,
	complete: CompleteGeneration
): Promise<GenerationResult> {
	const startedAt = new Date().toISOString();
	let process: TaskProcessResult;
	try {
		process = await launch(input);
	} catch (error) {
		return {
			metric: {
				status: input.signal.aborted ? 'interrupted' : 'failed',
				sessionId: null,
				peakContextTokens: null,
				apiCost: estimateApiCost(input.model),
				startedAt,
				finishedAt: new Date().toISOString()
			},
			error:
				error instanceof Error ? error : new ModuleTaskRunError('Could not start the task CLI.')
		};
	}
	const events = process.stdout.split('\n').flatMap(parseEvent);
	const terminalUsage = taskUsage(input.provider, events);
	const usage =
		terminalUsage.inputTokens !== null || terminalUsage.reportedCostUsd !== null
			? terminalUsage
			: (process.observation?.usage ?? terminalUsage);
	const outcome = generationOutcome(input, process, events, complete);
	const reportedModel =
		events.find((e) => e.type === 'system' && e.subtype === 'init')?.model ?? null;
	if (outcome.error) Object.assign(outcome.error, { reportedModel });
	return {
		metric: {
			status: outcome.status,
			sessionId: process.observation?.sessionId ?? null,
			peakContextTokens: process.observation?.peakContextTokens ?? null,
			usage,
			apiCost: estimateApiCost(
				outcome.result?.reportedModel ?? reportedModel ?? input.model,
				usage
			),
			startedAt,
			finishedAt: new Date().toISOString()
		},
		result: outcome.result,
		error: outcome.error
	};
}

function generationOutcome(
	input: TaskRunInput,
	result: TaskProcessResult,
	events: TaskPublicEvent[],
	complete: CompleteGeneration
) {
	const stop = result.stop;
	if (stop === 'hard-limit')
		return {
			status: stop,
			error: new ModuleTaskRunError(
				`Provider reached the ${hardContextTokens}-token emergency stop.`
			)
		};
	if (input.signal.aborted || stop === 'interrupted')
		return {
			status: 'interrupted' as const,
			error: new ModuleTaskRunError('Task CLI interrupted.')
		};
	if (stop === 'rotated') return { status: stop };
	if (stop) {
		const message =
			stop === 'timeout' ? 'Task CLI timed out.' : 'Live context telemetry became unavailable.';
		return { status: 'failed' as const, error: new ModuleTaskRunError(message) };
	}
	try {
		return { status: 'succeeded' as const, result: complete(events, result.code, input) };
	} catch (error) {
		return {
			status: 'failed' as const,
			error: error instanceof Error ? error : new ModuleTaskRunError('Task execution failed.')
		};
	}
}

function parseEvent(line: string): TaskPublicEvent[] {
	if (!line.trim()) return [];
	try {
		const event = JSON.parse(line);
		return event && typeof event.type === 'string' ? [event] : [];
	} catch {
		return [];
	}
}
