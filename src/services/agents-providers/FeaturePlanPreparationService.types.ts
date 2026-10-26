import type { FeaturePlan } from '../../repositories/agents-providers/ModuleTaskRepository.types';
import type { ModuleData } from '../git-source-history/ModuleDataService.types';

export type FeaturePlanProposal = Omit<FeaturePlan, 'pages' | 'revision' | 'digest' | 'approval'>;
export type PreparedFeaturePlan = Omit<FeaturePlan, 'revision' | 'digest' | 'approval'>;
export type PreparationPage = FeaturePlan['pages'][number];
export type PreparationDiscovery = { valid: boolean; affectedPages: string[]; errors: string[] };
export type PreparationCoverage = PreparationDiscovery & { missingPages: string[] };
export type FeaturePlanPreparationInput = {
	proposal: FeaturePlanProposal;
	data: ModuleData;
	signal: AbortSignal;
};
export type FeaturePlanPreparationDependencies = {
	discover(
		input: Pick<FeaturePlanProposal, 'sourceCommit' | 'changes'>,
		data: ModuleData
	): PreparationDiscovery | Promise<PreparationDiscovery>;
	preparePage(input: {
		module: string;
		sourceCommit: string;
		count: 3;
		signal: AbortSignal;
	}): Promise<PreparationPage>;
	admit<T>(action: () => Promise<T>): Promise<T>;
	finalize(
		input: { sourceCommit: string; pages: PreparationPage[] },
		signal: AbortSignal
	): Promise<{ sourceCommit: string; data: ModuleData }>;
	verify(
		plan: PreparedFeaturePlan,
		data: ModuleData
	): PreparationCoverage | Promise<PreparationCoverage>;
	draft(plan: PreparedFeaturePlan): Promise<FeaturePlan>;
};
