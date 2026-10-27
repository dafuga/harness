import type { ComponentManifest } from '../../../src/core/unitTypes';
import type { ContractCase } from '../../../src/services/verification-evidence/TestContractService';

export type MethodStateMap = Record<string, string[]>;

export interface SyntheticMethodLifecycleContract {
	version: 1;
	shape: 'service';
	methodStates: MethodStateMap;
	cases: ContractCase[];
}

export interface SyntheticMethodLifecycleFixture {
	owner: ComponentManifest;
	contract: SyntheticMethodLifecycleContract;
}
