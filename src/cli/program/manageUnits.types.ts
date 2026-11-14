// @harness-uid u_k4g4widopi
import type { UnitIndexResult } from '../../workflows/development-tooling/load-units/unit-index-service/UnitIndexService';
import type { contractFailureCounts } from '../../validators/development-tooling/contractFindings';

export interface UnitsOptions {
	root?: string;
	json?: boolean;
	write?: boolean;
	now?: () => string;
}

export type IndexReport = Omit<UnitIndexResult, 'manifests'> & {
	units: number;
	written: string[];
	uncertain: number;
};

export interface CheckReport {
	warnings?: string[];
	units: number;
	uncertain: number;
	errors: string[];
	contractFailures?: ReturnType<typeof contractFailureCounts>;
	storedContractFailures?: ReturnType<typeof contractFailureCounts>;
}
