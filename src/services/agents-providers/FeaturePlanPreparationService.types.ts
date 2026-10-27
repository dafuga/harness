import type { FeaturePlan } from '../../repositories/agents-providers/ModuleTaskRepository.types';
import type { ModuleData } from '../git-source-history/ModuleDataService.types';

export type FeaturePlanProposal = Omit<FeaturePlan, 'pages' | 'revision' | 'digest' | 'approval'>;
export type PreparedFeaturePlan = Omit<FeaturePlan, 'revision' | 'digest' | 'approval'>;
export type PreparationPage = FeaturePlan['pages'][number];
export type PreparationOption = {
	id: string;
	preferred: boolean;
	direction: string;
	prompt: string;
	revisedPrompt: string | null;
	bytes: Uint8Array;
};
export type PreparationChoice = Pick<PreparationOption, 'id' | 'preferred' | 'direction'> & {
	instruction: string;
};
export type GeneratedPage = { module: string; options: PreparationOption[] };
export type PreparationDesignReference = {
	kind: 'current' | 'wanted';
	entityId: string;
	commit: string;
	version: string;
	state: string;
	viewport: string;
	file: string;
	sha256: string;
	option?: string;
};
export type PreparationPageDesign = {
	module: string;
	reference: PreparationDesignReference;
	region: { x: number; y: number; width: number; height: number } | null;
	options: PreparationChoice[];
};
export type PreparationDiscovery = { valid: boolean; affectedPages: string[]; errors: string[] };
export type PreparationCoverage = PreparationDiscovery & { missingPages: string[] };
export type FeaturePlanPreparationInput = {
	proposal: FeaturePlanProposal;
	data: ModuleData;
	originalRequest: string;
	pageDesigns: PreparationPageDesign[];
	signal: AbortSignal;
};
export type FeaturePlanPreparationDependencies = {
	discover(
		input: Pick<FeaturePlanProposal, 'sourceCommit' | 'changes'>,
		data: ModuleData
	): PreparationDiscovery | Promise<PreparationDiscovery>;
	preparePage(input: {
		module: string;
		moduleGoal: string;
		options: PreparationChoice[];
		sourceCommit: string;
		count: 3;
		goal: string;
		tldr: string;
		originalRequest: string;
		reference: PreparationDesignReference;
		region: PreparationPageDesign['region'];
		imagePrompt: string;
		signal: AbortSignal;
	}): Promise<GeneratedPage>;
	admit<T>(action: () => Promise<T>): Promise<T>;
	finalize(
		input: { sourceCommit: string; pages: GeneratedPage[]; designs: PreparationPageDesign[] },
		signal: AbortSignal
	): Promise<{ sourceCommit: string; data: ModuleData; pages: PreparationPage[] }>;
	verify(
		plan: PreparedFeaturePlan,
		data: ModuleData
	): PreparationCoverage | Promise<PreparationCoverage>;
	draft(plan: PreparedFeaturePlan): Promise<FeaturePlan>;
};
