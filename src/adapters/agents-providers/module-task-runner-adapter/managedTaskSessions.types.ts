// @harness-uid u_rw64iex44n
import type {
	TaskRunInput,
	TaskRunResult,
	TaskSessionMetric
} from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import type { TaskProcessResult, TaskPublicEvent } from '../ModuleTaskRunnerAdapter.types';

export type LaunchGeneration = (input: TaskRunInput) => Promise<TaskProcessResult>;
export type CompleteGeneration = (
	events: TaskPublicEvent[],
	code: number,
	input: TaskRunInput
) => TaskRunResult;

export interface GenerationResult {
	metric: TaskSessionMetric;
	result?: TaskRunResult;
	error?: Error;
}
