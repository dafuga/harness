// @harness-uid u_rw64iex44n
import type { TaskRunInput } from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import { estimateApiCost } from '../../../services/agents-providers/module-task-analytics-service/modelRunPricing';
import { trackerSecretSafetyRule } from '../../../services/projects-sessions/tracker-native-runtime-service/trackerSecretSafetyRule';
import { ModuleTaskRunError } from '../ModuleTaskRunnerAdapter.types';
import type { SessionObservation } from '../ProviderSessionAdapter.types';
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
		const prompt = input.prompt.startsWith(trackerSecretSafetyRule)
			? input.prompt
			: trackerSecretSafetyRule + '\n\n' + input.prompt;
		if (Buffer.byteLength(prompt) > 96 * 1024)
			throw new ModuleTaskRunError('Task prompt exceeds the 96 KiB context admission limit.');
		process = await launch({ ...input, prompt });
	} catch (error) {
		return generationLaunchFailure(input, startedAt, error);
	}
	return completedGeneration(input, process, complete, startedAt);
}

function generationLaunchFailure(
	input: TaskRunInput,
	startedAt: string,
	error: unknown
): GenerationResult {
	return {
		metric: {
			status: input.signal.aborted ? 'interrupted' : 'failed',
			sessionId: null,
			peakContextTokens: null,
			apiCost: estimateApiCost(input.model),
			startedAt,
			finishedAt: new Date().toISOString()
		},
		error: error instanceof Error ? error : new ModuleTaskRunError('Could not start the task CLI.')
	};
}

function completedGeneration(
	input: TaskRunInput,
	process: TaskProcessResult,
	complete: CompleteGeneration,
	startedAt: string
): GenerationResult {
	const lines = process.stdout.split('\n').filter((line) => line.trim());
	const events = lines.flatMap(parseEvent);
	const usage = generationUsage(input, process, events);
	const outcome = generationOutcome(input, process, events, {
		complete,
		malformed: lines.length !== events.length
	});
	const observation = generationObservation(input, process, events);
	const reportedModel =
		events.find((e) => e.type === 'system' && e.subtype === 'init')?.model ?? null;
	if (outcome.error) Object.assign(outcome.error, { reportedModel });
	return {
		metric: {
			status: outcome.status,
			...observation,
			preRequestEstimateTokens: process.preRequestEstimateTokens,
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

function generationObservation(
	input: TaskRunInput,
	process: TaskProcessResult,
	events: TaskPublicEvent[]
): Pick<SessionObservation, 'sessionId' | 'peakContextTokens'> {
	return {
		sessionId: process.observation?.sessionId ?? generationSessionId(input, events),
		peakContextTokens: process.observation?.peakContextTokens ?? null
	};
}

function generationSessionId(input: TaskRunInput, events: TaskPublicEvent[]): string | null {
	if (!input.session) return null;
	return input.provider === 'codex'
		? (events.find((event) => event.type === 'thread.started')?.thread_id ?? null)
		: (events.find((event) => event.type === 'system' && event.subtype === 'init')?.session_id ??
				null);
}

function generationUsage(
	input: TaskRunInput,
	process: TaskProcessResult,
	events: TaskPublicEvent[]
) {
	const terminal = taskUsage(input.provider, events);
	if (terminal.inputTokens !== null || terminal.reportedCostUsd !== null) return terminal;
	return process.observation?.usage ?? terminal;
}

function generationOutcome(
	input: TaskRunInput,
	result: TaskProcessResult,
	events: TaskPublicEvent[],
	output: { complete: CompleteGeneration; malformed: boolean }
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
		if (output.malformed)
			throw new ModuleTaskRunError('Task CLI returned malformed structured output.');
		return { status: 'succeeded' as const, result: output.complete(events, result.code, input) };
	} catch (error) {
		return {
			status: 'failed' as const,
			error: error instanceof Error ? error : new ModuleTaskRunError('Task execution failed.')
		};
	}
}

function parseEvent(line: string): TaskPublicEvent[] {
	try {
		const event = JSON.parse(line);
		return event && typeof event.type === 'string' ? [event] : [];
	} catch {
		return [];
	}
}
