import type { z } from 'zod';
import type {
	regressionRecordSchema,
	regressionPhaseSchema,
	regressionViewSchema
} from './regressionTypes';

/** A focused regression result never grants full verification or a budget baseline. */
export type RegressionRecord = z.infer<typeof regressionRecordSchema>;

export type RegressionPhase = z.infer<typeof regressionPhaseSchema>;

export type RegressionPoint = NonNullable<z.infer<typeof regressionViewSchema>['red']>;

export type RegressionView = z.infer<typeof regressionViewSchema>;
