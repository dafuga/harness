import type { CommitTreeAdapter } from '../../adapters/CommitTreeAdapter';
import type { ModuleTaskRepository } from '../../repositories/agents-providers/ModuleTaskRepository';
import type { UnitRegistryRepository } from '../../repositories/UnitRegistryRepository';
import type { FeaturePlanService } from '../../services/agents-providers/FeaturePlanService';
import type { ModuleTaskWorkerService } from '../../services/agents-providers/ModuleTaskWorkerService';
import type {
	FeaturePlan,
	ModuleTask,
	TaskFeature
} from '../../repositories/agents-providers/ModuleTaskRepository.types';
import type { requireModuleData } from '../../services/git-source-history/module-data-service/moduleDataAdmission';
import type {
	taskGrantFiles,
	validateTaskGrant
} from '../../services/agents-providers/module-task-service/queuedTask';

export type SubmissionDependencies = {
	root: string;
	repository: Pick<ModuleTaskRepository, 'read'>;
	openTree: typeof CommitTreeAdapter.open;
	registry: Pick<UnitRegistryRepository, 'read'>;
	requireMetadata: typeof requireModuleData;
	grantFiles: typeof taskGrantFiles;
	validateGrant: typeof validateTaskGrant;
};

/** A trusted server's verified approval and the exact task definitions it admitted. */
export type ApprovedTaskScope = {
	plan: FeaturePlan;
	feature: TaskFeature;
	records: ModuleTask[];
};

export type ServerWorker = Pick<ModuleTaskWorkerService, 'once'> &
	Partial<Pick<ModuleTaskWorkerService, 'onceApproved'>>;
export type ApprovedExecution = { worker: string; parallelism: number; signal: AbortSignal };
export type ServerDependencies = Partial<{
	repository: ModuleTaskRepository;
	openTree: typeof CommitTreeAdapter.open;
	registry: Pick<UnitRegistryRepository, 'read'>;
	requireMetadata: typeof requireModuleData;
	worker: ServerWorker;
	grantFiles: typeof taskGrantFiles;
	validateGrant: typeof validateTaskGrant;
	plans: Pick<FeaturePlanService, 'approved'>;
}>;
