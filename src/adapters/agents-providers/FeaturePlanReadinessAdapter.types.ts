import type { createPlanning } from '../../../packages/planning/src/index';
import type { GitAdapter } from '../git-source-history/GitAdapter';
import type { ModuleData } from '../../services/git-source-history/ModuleDataService.types';
import type { FeaturePlanCoverageValidator } from '../../validators/agents-providers/FeaturePlanCoverageValidator';
import type { FeaturePlanValidator } from '../../validators/agents-providers/FeaturePlanValidator';

export interface FeaturePlanReadinessAdapterConfig {
	name?: string;
}

export interface FeaturePlanReadinessDependencies {
	git?: Pick<GitAdapter, 'run'>;
	planning?: Pick<Awaited<ReturnType<typeof createPlanning>>, 'readImage'>;
	requireMetadata?: (root: string, commit: string) => Promise<ModuleData>;
	validator?: Pick<FeaturePlanValidator, 'validate'>;
	coverage?: Pick<FeaturePlanCoverageValidator, 'validate'>;
}
