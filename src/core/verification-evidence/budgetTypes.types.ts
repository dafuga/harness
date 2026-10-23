import type { z } from 'zod';
import type { budgetEventSchema, performanceBaselineSchema } from './budgetTypes';

export type BudgetEvent = z.infer<typeof budgetEventSchema>;

export type PerformanceBaselineEntry = z.infer<typeof performanceBaselineSchema>;
