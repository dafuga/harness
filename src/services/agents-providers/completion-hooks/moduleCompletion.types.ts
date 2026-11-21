import type {
	ModuleTask,
	TaskRunner
} from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import type { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import type { CompletionConfig } from './completionRun.types';

export interface ModuleCompletionInput {
	owner: GitAdapter;
	task: ModuleTask;
	result: NonNullable<ModuleTask['result']>;
	context: ModuleCompletionContext;
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
