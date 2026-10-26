export interface FeaturePlanValidatorOptions {
	requireSelection?: boolean;
}

export interface FeaturePlanValidatorResult {
	valid: boolean;
	errors: string[];
}
