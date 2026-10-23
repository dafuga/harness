import type { hostCpuCounters } from './resourceCpu';

export type Counters = ReturnType<typeof hostCpuCounters>;
