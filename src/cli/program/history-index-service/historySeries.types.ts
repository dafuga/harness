import type { HistoryIndex } from '../../../core/git-source-history/historyIndexTypes';
import type { BenchmarkSeries } from '../../../core/git-source-history/historyIndexTypes';

export type Growth = HistoryIndex['units'];

export type Point = Growth[number]['growth'][number];

export type Line = BenchmarkSeries['series'][number];

export type Head = Pick<BenchmarkSeries, 'unit' | 'workload' | 'metric' | 'target'>;
