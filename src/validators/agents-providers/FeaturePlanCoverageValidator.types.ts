export interface FeaturePlanCoverageValidatorResult {
	valid: boolean;
	errors: string[];
	affectedPages: string[];
	missingPages: string[];
}
