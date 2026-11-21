import type {
	TaskRunInput,
	TaskRunResult,
	TaskSelection
} from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import type { loadCompletionConfig } from './completionConfig';

export type CompletionConfig = Awaited<ReturnType<typeof loadCompletionConfig>>;
export type CompletionCheck = CompletionConfig['checks'][number];
export type CompletionScope = CompletionCheck['scope'];
export type CompletionProvider = (input: TaskRunInput, readOnly: boolean) => Promise<TaskRunResult>;

export interface CompletionRun extends TaskSelection {
	id: string;
	scope: CompletionScope;
	revision: string;
	path: string;
	checks: CompletionReceipt[];
	signal: AbortSignal;
}

export interface CompletionReceipt {
	name: string;
	required: boolean;
	status: 'passed' | 'failed' | 'disabled' | 'blocked';
	summary?: string;
	reason?: string;
	disposition?: 'applied' | 'discarded' | 'unchanged';
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
