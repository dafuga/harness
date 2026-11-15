import type { ImpactInput } from '../src/core/execution-runtimes/kernelTypes';
import type { ImpactOutput } from '../src/core/execution-runtimes/kernelTypes';

export type Case = { name: string; input: ImpactInput; expected: ImpactOutput };
