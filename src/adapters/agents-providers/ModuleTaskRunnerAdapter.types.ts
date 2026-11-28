// @harness-uid u_rw64iex44n
import type { TaskRunInput } from '../../repositories/agents-providers/ModuleTaskRepository.types';
import type { SessionObservation } from './ProviderSessionAdapter.types';
export interface TaskProcessResult {
	code: number;
	stdout: string;
	observation?: SessionObservation;
	preRequestEstimateTokens?: number;
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
	thread_id?: string;
	session_id?: string;
	message?: string;
	error?: string | { type?: string; code?: string; message?: string; resets_at?: number };
	rate_limit_info?: { status?: string; resetsAt?: number };
	item?: { type?: string; text?: string };
	modelUsage?: Record<string, unknown>;
	permission_denials?: unknown[];
	usage?: Record<string, unknown>;
	total_cost_usd?: number;
}
export { ModuleTaskRunError } from './module-task-runner-adapter/ModuleTaskRunError';
