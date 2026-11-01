import type { ComponentManifest } from '../../../core/development-tooling/unitTypes';
import type { SourceTree, SourceGraph } from '../../../core/development-tooling/sourceTypes';
import type { TestAttribution } from '../../../cli/program/testAttribution.types';
import type { LoadedUnits } from '../load-units/loadUnits';

export interface GuidanceOptions {
	root?: string;
	requiredStates?: string[];
}

export interface StateRegistry {
	entity: string;
	where: string;
	kind: 'catalog' | 'required-states';
	states: string[];
}

export interface UnitState {
	name: string;
	origin: 'REQUIRED' | 'GUESS';
	reasons: string[];
}

export interface GuidanceContext {
	loaded: LoadedUnits;
	tree: SourceTree;
	registries: StateRegistry[];
	texts: Map<string, string>;
	graph?: SourceGraph;
	testAttributions: Map<string, TestAttribution>;
	testSyntax: Map<string, { test: boolean; states: Set<string>; matrix: boolean }>;
}

export interface StateTest {
	file: string;
	viewports: string[];
}

export interface GuideState extends UnitState {
	tests: StateTest[];
	viewports: Record<string, 'DONE' | 'MISSING'>;
	status: 'DONE' | 'MISSING';
}

export interface GuideReport {
	entity: string;
	commit: string;
	states: GuideState[];
	summary: { done: number; missing: number };
	next: { state: string; commands: string[] } | null;
	proof: { store: 'git'; gap: string | null };
}

export interface ContractFinding {
	entity: string;
	kind:
		| 'missing-required'
		| 'missing-default'
		| 'missing-errors'
		| 'missing-output'
		| 'undocumented-prop'
		| 'undocumented-state'
		| 'untested-state'
		| 'required-states-incomplete';
	detail: string;
	where: string;
}

export interface ContractCheckReport {
	entities: string[];
	findings: ContractFinding[];
	counts: Array<{ entity: string; findings: number }>;
	summary: { entities: number; findings: number };
}

export interface ContractScope {
	name: string;
	contract: Pick<ComponentManifest['contract'], 'inputs' | 'outputs' | 'errors' | 'errorStatus'>;
}
