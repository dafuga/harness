import type { FeaturePlanCoverageValidatorResult } from './FeaturePlanCoverageValidator.types';

export class FeaturePlanCoverageValidator {
	validate(input: Record<string, unknown>): FeaturePlanCoverageValidatorResult {
		const errors = Object.keys(input).length === 0 ? ['input is empty'] : [];
		return { valid: errors.length === 0, errors };
	}
}

export type { FeaturePlanCoverageValidatorResult } from './FeaturePlanCoverageValidator.types';
