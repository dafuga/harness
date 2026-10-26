import type { createPlanning } from '../../../packages/planning/src/index';
import type { GitAdapter } from '../git-source-history/GitAdapter';
import type { FeaturePlanValidator } from '../../validators/agents-providers/FeaturePlanValidator';

export interface FeaturePlanReadinessAdapterConfig {
	name?: string;
}

export interface FeaturePlanReadinessDependencies {
	git?: Pick<GitAdapter, 'run'>;
	planning?: Pick<Awaited<ReturnType<typeof createPlanning>>, 'readImage'>;
	requireMetadata?: (root: string, commit: string) => Promise<unknown>;
	validator?: Pick<FeaturePlanValidator, 'validate'>;
}
