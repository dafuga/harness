// @harness-uid u_rw64iex44n
import type { TaskRunInput } from '../../repositories/agents-providers/ModuleTaskRepository.types';
import type { SessionObservation } from './ProviderSessionAdapter.types';
export interface TaskProcessResult {
	code: number;
	stdout: string;
	observation?: SessionObservation;
	stop?: 'rotated' | 'hard-limit' | 'meter-unavailable' | 'interrupted' | 'timeout';
}
/** Runs one task CLI command for a run input and resolves its captured exit code and stdout. */
export type TaskProcessExecutor = (
	command: string[],
	input: TaskRunInput
) => Promise<TaskProcessResult>;
export interface TaskPublicEvent {
	type: string;
	subtype?: string;
	model?: string;
	is_error?: boolean;
	result?: string;
	error?: string | { type?: string; code?: string };
	rate_limit_info?: { status?: string };
	item?: { type?: string; text?: string };
	modelUsage?: Record<string, unknown>;
	permission_denials?: unknown[];
	usage?: Record<string, unknown>;
	total_cost_usd?: number;
}
/** A module task CLI run that failed, or was rejected for its quota, model or tool use. */
export class ModuleTaskRunError extends Error {
	override name = 'ModuleTaskRunError';
}
