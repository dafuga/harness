import type { z } from 'zod';
import type {
	captureSchema,
	scenarioResultSchema,
	profileSchema,
	budgetFindingSchema,
	componentVersionSchema,
	measurementSchema,
	verificationRecordSchema
} from './verificationTypes';

export type Capture = z.infer<typeof captureSchema>;

export type ScenarioResult = z.infer<typeof scenarioResultSchema>;

export type VerificationProfile = z.infer<typeof profileSchema>;

export type BudgetFinding = z.infer<typeof budgetFindingSchema>;

export type RecordedComponent = z.infer<typeof componentVersionSchema>;

export type Measurement = z.infer<typeof measurementSchema>;

export type VerificationRecord = z.infer<typeof verificationRecordSchema>;
