import type { FeaturePlanRepository } from '../../repositories/agents-providers/FeaturePlanRepository';
import type { FeaturePlan } from '../../repositories/agents-providers/ModuleTaskRepository.types';
import type { FeaturePlanValidator } from '../../validators/agents-providers/FeaturePlanValidator';

export type Dependencies = {
	repository: Pick<FeaturePlanRepository, 'read' | 'append' | 'approve'>;
	validator: Pick<FeaturePlanValidator, 'validate'>;
	verifyReady?: (plan: FeaturePlan) => Promise<void>;
	now?: () => string;
};
export type Draft = Omit<FeaturePlan, 'revision' | 'digest' | 'approval'>;
export type Selection = { feature: string; page: string; option: string; expectedDigest: string };
export type Approval = { feature: string; expectedDigest: string; reviewer: string };
