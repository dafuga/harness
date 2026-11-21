import type { BenchmarkRun } from '../../src/core/agents-providers/subagentBenchmarkTypes';

export type Rendered = { run: BenchmarkRun; comparison: Array<Record<string, unknown>> };
