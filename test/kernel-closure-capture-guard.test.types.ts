import type { ImpactInput } from '../src/core/kernelTypes';
import type { ImpactOutput } from '../src/core/kernelTypes';

export type Call = { name: string; input: ImpactInput; output: ImpactOutput };

export type Recorded = Record<string, unknown> & { cases: Call[] };
