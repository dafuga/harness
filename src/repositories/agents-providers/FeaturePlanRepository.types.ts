import type { ModuleTaskRepository } from './ModuleTaskRepository';
import type { FeaturePlan, FeaturePlanApproval } from './ModuleTaskRepository.types';

export interface RepositoryRecord {
	id: number;
}

export type FeaturePlanQueueRepository = Pick<ModuleTaskRepository, 'read' | 'update'>;
export type FeaturePlanApprovalInput = Pick<FeaturePlan, 'feature' | 'revision'> &
	FeaturePlanApproval;
export interface FeaturePlanReadResult {
	commit: string | undefined;
	plans: FeaturePlan[];
}
export interface FeaturePlanWriteResult {
	commit: string | undefined;
	plan: FeaturePlan;
}
