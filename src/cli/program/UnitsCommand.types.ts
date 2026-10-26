import type { ContractItem } from '../../core/development-tooling/unitTypes';

export interface DeclaredContractInput {
	responsibility: string;
	contract: {
		inputs: ContractItem[];
		outputs: ContractItem[];
		errors: ContractItem[];
	};
}

export interface Flags {
	json?: boolean;
	write?: boolean;
	kind?: string;
	reason?: string;
	input?: string;
}
