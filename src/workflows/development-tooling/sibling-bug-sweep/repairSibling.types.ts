// @harness-uid u_wwerrde2nk
import type { TaskRunner } from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import type {
	BugEvaluator,
	BugSweepReport
} from '../../../utils/development-tooling/siblingBugSweep.types';

export interface RepairOptions {
	root: string;
	runId: string;
	testCommand: string;
	workerModel: string;
}

export interface RepairDependencies {
	runner: TaskRunner;
	evaluate: BugEvaluator;
}

export interface SiblingRepairResult {
	id: string;
	outcome: 'accepted' | 'rejected' | 'failed';
	evidence: string;
	ref?: string;
	red?: { commit: string; record: string };
	green?: { commit: string; record: string };
}

export interface RepairContext extends RepairOptions {
	report: BugSweepReport;
}
