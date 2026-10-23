import type { Comparison } from '../../../core/development-tooling/comparisonTypes';
import type { RuntimeKind } from '../../../core/development-tooling/unitTypes';

export interface UnitBenchmark {
	unit: string;
	workload: string;
	target: RuntimeKind;
	/** Hash of the unit's response, so a slowdown can be shown to leave the result unchanged. */
	responseDigest: string;
	measurements: Array<{
		unit: string;
		metric: string;
		unitOfMeasure: string;
		value: number;
		method: string;
		workload: string;
		target: RuntimeKind;
		samples: number;
		/** Derived from the request that was sent and the sampling that was used. */
		comparison: Comparison;
	}>;
}
