import { comparisonDifferences } from '../../src/services/budget-service/comparisonDifferences';
import { measureWorkload } from './measureWorkload';
import type { ComparisonExampleArguments } from './comparisonDifferencesExamples.types';

/** Keep actual comparisons and process-level workload observations together. */
export function executeComparisonExample(...args: ComparisonExampleArguments) {
	return measureWorkload('function.comparison-differences', 'declared-comparison-example', () =>
		comparisonDifferences(...args)
	);
}
