import type { LoopEvaluator } from '../loop-state/loopState';

export interface LoopTemplateStep {
	id: string;
	title: string;
}

export interface LoopTemplate {
	id: string;
	title: string;
	summary: string;
	extends?: string;
	steps: LoopTemplateStep[];
	evaluators?: LoopEvaluator[];
	source?: 'built-in' | 'project';
}

export interface ResolvedLoopTemplate {
	id: string;
	title: string;
	summary: string;
	lineage: string[];
	steps: LoopTemplateStep[];
	evaluators: LoopEvaluator[];
}
