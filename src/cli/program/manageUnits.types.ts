import type { UnitIndexResult } from '../../workflows/development-tooling/load-units/unit-index-service/UnitIndexService';

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
	units: number;
	uncertain: number;
	errors: string[];
}
