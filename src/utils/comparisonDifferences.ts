/** The part of a measurement or of a frozen baseline that says what was measured, and how. */
export interface MeasuredDefinition {
	unitOfMeasure?: string;
	method?: string;
	comparison?: unknown;
}

export interface ComparisonVerdict {
	status: 'comparable' | 'incomplete' | 'incompatible';
	/** Why the two cannot be compared; empty when they can. */
	differences: string[];
}

export { comparisonDifferences } from '../services/budget-service/comparisonDifferences';
