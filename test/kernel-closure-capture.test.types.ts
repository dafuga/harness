import type { ImpactInput } from '../src/core/kernelTypes';
import type { ImpactOutput } from '../src/core/kernelTypes';

export type Case = { name: string; input: ImpactInput; expected: ImpactOutput };
