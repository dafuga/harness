import type { TaskRunInput } from '../../repositories/agents-providers/ModuleTaskRepository.types';

export interface TaskProcessResult {
	code: number;
	stdout: string;
	stderr?: string;
}

export interface TaskProcessInput extends TaskRunInput {
	env?: Record<string, string | undefined>;
}

export type TaskFailureCategory =
	| 'authentication'
	| 'model-access'
	| 'permission'
	| 'invalid-response'
	| 'resource'
	| 'spawn';
export type ProviderFailureCategory = Exclude<TaskFailureCategory, 'resource' | 'spawn'>;

export interface TaskFailureDiagnostic {
	category: TaskFailureCategory;
	phase: 'prelaunch' | 'provider' | 'response';
	nextAction: string;
}
export type TaskPrelaunchFailureCategory = Extract<TaskFailureCategory, 'resource' | 'spawn'>;

export interface TaskPublicEvent {
	type: string;
	subtype?: string;
	model?: string;
	is_error?: boolean;
	result?: string;
	error?: string | { type?: string; code?: string; message?: string };
	message?: string;
	code?: string;
	errors?: string[];
	rate_limit_info?: { status?: string };
	item?: { type?: string; text?: string };
	modelUsage?: Record<string, unknown>;
	permission_denials?: unknown[];
	usage?: Record<string, unknown>;
	total_cost_usd?: number;
}
