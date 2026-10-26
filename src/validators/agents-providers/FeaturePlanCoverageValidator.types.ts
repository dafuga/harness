import type { FeaturePlan } from '../../repositories/agents-providers/ModuleTaskRepository.types';
import type { ModuleData } from '../../services/git-source-history/ModuleDataService.types';

export type Unit = ModuleData['registry']['units'][number];
export type Change = FeaturePlan['changes'][number];
export interface FeaturePlanCoverageValidatorResult {
	valid: boolean;
	errors: string[];
	affectedPages: string[];
	missingPages: string[];
}

export type FeaturePlanImpactInput = Pick<FeaturePlan, 'sourceCommit' | 'changes'>;
export interface FeaturePlanImpactResult {
	valid: boolean;
	affectedPages: string[];
	errors: string[];
}
