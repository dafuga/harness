import type { z } from 'zod';
import type { testContractSchema } from './test-contract-service/testContractSchema';
import type { ComponentManifest, ScenarioManifest } from '../../core/development-tooling/unitTypes';
export type TestContract = z.infer<typeof testContractSchema>;
export type ContractCase = TestContract['cases'][number];
export interface ContractRegistry {
	units: ComponentManifest[];
	scenarios: ScenarioManifest[];
	files: ReadonlySet<string>;
	tests?: ReadonlyArray<{ file: string; title: string }>;
	required?: boolean;
	execution?: CaseExecution;
}
export interface CaseOutcome {
	file: string;
	title: string;
	revision: string;
	status: 'passed' | 'failed' | 'skipped';
	retry?: number;
}
export interface CaseExecution {
	revision: string;
	files: string[];
	outcomes: CaseOutcome[];
}
