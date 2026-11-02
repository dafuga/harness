// @harness-uid u_hg7pblofmf
import type { z } from 'zod';
import type { comparisonSchema } from './comparisonTypes';

export type Comparison = z.infer<typeof comparisonSchema>;
