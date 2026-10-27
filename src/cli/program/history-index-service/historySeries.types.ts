import type { HistoryIndex } from '../../../core/git-source-history/historyIndexTypes';
import type { BenchmarkSeries } from '../../../core/git-source-history/historyIndexTypes';

export type Growth = HistoryIndex['units'];

export type Point = Growth[number]['growth'][number];

export type Line = BenchmarkSeries['series'][number];

export type Head = Pick<BenchmarkSeries, 'unit' | 'workload' | 'metric' | 'target'>;

import type {
	RegressionPoint,
	RegressionView
} from '../../../core/verification-evidence/regressionTypes';

/** Index aggregation needs only a focused run's identity, gap and measurements. */
export type FocusedPoint = Pick<RegressionPoint, 'id' | 'commit' | 'measurements'>;
export type FocusedRun = Pick<RegressionView, 'loop' | 'gap'> & {
	red: FocusedPoint | null;
	green?: FocusedPoint;
};
