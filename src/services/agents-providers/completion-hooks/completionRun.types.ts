// @harness-uid u_xghv2ih7cg
import type {
	ModuleTask,
	TaskRunInput,
	TaskRunResult,
	TaskSelection
} from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import type { loadCompletionConfig } from './completionConfig';
import type { completionTurn } from './completionRun';

export type CompletionConfig = Awaited<ReturnType<typeof loadCompletionConfig>>;
export type CompletionCheck = CompletionConfig['checks'][number];
export type CompletionScope = CompletionCheck['scope'];
export type CompletionTurnInput = TaskRunInput & { [completionTurn]?: boolean };
export type CompletionProvider = (input: CompletionTurnInput) => Promise<TaskRunResult>;

export interface CompletionRun extends TaskSelection {
	id: string;
	scope: CompletionScope;
	revision: string;
	path: string;
	checks: CompletionReceipt[];
	signal: AbortSignal;
	tracking?: { item: string; status: 'recorded' | 'unavailable' };
}

export interface CompletionReceipt {
	name: string;
	required: boolean;
	status: 'passed' | 'failed' | 'disabled' | 'blocked';
	summary?: string;
	reason?: string;
	disposition?: 'applied' | 'discarded' | 'unchanged';
	candidateCheck?: NonNullable<NonNullable<ModuleTask['result']>['checkRounds']>[number];
	before?: ModuleMeasurement;
	after?: ModuleMeasurement;
}

export type CoverageMetric = { hit: number; total: number; percent: number };
export type FileCoverage = Partial<Record<'lines' | 'functions' | 'branches', CoverageMetric>>;

export interface ModuleMeasurement {
	bytes: { source: number; tests: number };
	testExitCode?: number;
	coverage?: Record<string, FileCoverage>;
}
