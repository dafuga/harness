import type { CheckResult } from '../scripts/shared-checks/sharedCheck.types';

export interface Fixture {
	folder: string;
	repo: string;
	home: string;
	first: string;
	second: string;
	failing: string;
	notes: string;
}

export interface Measurement {
	code: number | null;
	result: CheckResult & { commit: string };
	wallMs: number;
}
