import type { CommitTreeAdapter } from '../../adapters/CommitTreeAdapter';
import type { ModuleTaskRepository } from '../../repositories/agents-providers/ModuleTaskRepository';
import type { UnitRegistryRepository } from '../../repositories/UnitRegistryRepository';
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
