import type { FeaturePlanValidatorResult } from './FeaturePlanValidator.types';

export class FeaturePlanValidator {
	validate(input: Record<string, unknown>): FeaturePlanValidatorResult {
		const errors = Object.keys(input).length === 0 ? ['input is empty'] : [];
		return { valid: errors.length === 0, errors };
	}
}

export type { FeaturePlanValidatorResult } from './FeaturePlanValidator.types';
