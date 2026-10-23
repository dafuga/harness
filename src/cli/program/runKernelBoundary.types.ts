import type { RuntimeKind } from '../../core/development-tooling/unitTypes';
import type { Comparison } from '../../core/development-tooling/comparisonTypes';

export interface BoundaryBenchmark {
	unit: string;
	workload: string;
	measurements: Array<{
		unit: string;
		metric: string;
		unitOfMeasure: string;
		value: number;
		method: string;
		workload: string;
		target: RuntimeKind;
		samples: number;
		comparison: Comparison;
	}>;
}
