import type { HarnessUnit } from '../src/models/Harness.types';

export interface UnitSeed {
	id: string;
	kind: string;
	title: string;
	responsibility: string;
	uses?: string[];
	inputs?: string[];
	outputs?: string[];
	targets?: string[];
	performance?: HarnessUnit['budgets']['performance'];
}

export interface CaptureSeed {
	kind: string;
	state: string;
	viewport?: string;
	status?: 'passed' | 'failed';
	media?: string | null;
}
