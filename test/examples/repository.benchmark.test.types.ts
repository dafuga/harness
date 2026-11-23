import type { BenchmarkRepository } from '../../src/repositories/agents-providers/BenchmarkRepository';
import type { recordExampleCases } from '../support/recordExampleCases';

export type Run = Parameters<BenchmarkRepository['save']>[0];

export type Cases = Parameters<typeof recordExampleCases>[1];
