import type {
	ComponentManifest,
	ScenarioManifest
} from '../../../core/development-tooling/unitTypes';

export interface ContractEntry {
	id: string;
	kind: string;
	title: string;
	path: string;
	contractPath: string;
	responsibility: string;
	manifest: ComponentManifest;
	states: Array<ScenarioManifest['states'][number] & { scenario: string }>;
}

export type ContractSummary = Omit<ContractEntry, 'manifest' | 'states'>;

export interface ContractOptions {
	root?: string;
	kind?: string;
	area?: string;
	folder?: string;
	includeRetired?: boolean;
	limit?: number;
	json?: boolean;
	regex?: boolean;
	ignoreCase?: boolean;
	depth?: number;
}

export interface ContractMatch extends ContractSummary {
	field: string;
	snippet: string;
	score: number;
}

export interface ContractMap {
	query: string;
	matches: ContractSummary[];
	dependencies: ContractSummary[];
	dependents: ContractSummary[];
	unresolved: string[];
}

export interface ContractField {
	field: string;
	text: string;
	weight: number;
}
