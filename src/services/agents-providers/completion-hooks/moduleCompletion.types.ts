// @harness-uid u_xghv2ih7cg
import type {
	ModuleTask,
	TaskRunner
} from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import type { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import type { ModuleCompletionMeasurement } from './moduleCompletionMeasurement.types';
import type { CompletionConfig, CompletionReceipt } from './completionRun.types';

export interface ModuleCompletionInput {
	owner: GitAdapter;
	task: ModuleTask;
	result: NonNullable<ModuleTask['result']>;
	context: ModuleCompletionContext;
	/** Make installed packages available in a candidate worktree. */
	prepare?: (worktree: string) => Promise<void>;
}

export interface ModuleCompletionContext {
	runner: TaskRunner;
	signal: AbortSignal;
}

export interface ModuleCandidate {
	scratch: GitAdapter;
	input: ModuleCompletionInput;
	base: string;
	reportDirectory: string;
	verification: CompletionConfig['moduleVerification'];
}

export interface ModuleReductionAssessment {
	proposed: string;
	paths: string[];
	receipt: CompletionReceipt;
	measure: ModuleCompletionMeasurement;
}
