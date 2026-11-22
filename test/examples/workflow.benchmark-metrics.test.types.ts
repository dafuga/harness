import type { benchmarkMetrics } from '../../src/cli/program/benchmark-service/benchmarkMetrics';

export type Run = Parameters<typeof benchmarkMetrics>[0];

export type Trial = Run['trials'][number];

export type Usage = Trial['turns'][number]['usage'];
