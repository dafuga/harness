/**
 * Public verification contracts of Harness: reasons, budgets, the evidence protocol and the
 * rules that judge them. Importing this module has no side effects.
 */
export {
	explanationOutcomes,
	explanationSchema
} from '../core/development-tooling/explanationTypes';
export type {
	Explanation,
	ExplanationOutcome,
	ReasonStatus,
	RequiredReason
} from '../core/development-tooling/explanationTypes';
export {
	comparisonSchema,
	measurementBoundaries,
	metricUnits,
	roundsProtocol
} from '../core/development-tooling/comparisonTypes';
export type { Comparison } from '../core/development-tooling/comparisonTypes';
export {
	budgetEventSchema,
	performanceBaselineSchema
} from '../core/verification-evidence/budgetTypes';
export type {
	BudgetEvent,
	PerformanceBaselineEntry
} from '../core/verification-evidence/budgetTypes';
export {
	captureIndex,
	benchmarkCaptureSchema,
	captureLineSchema,
	defaultVerifyConfig,
	reportedMeasurementSchema,
	verifyConfigSchema,
	workloadSchema
} from '../core/verification-evidence/verifyTypes';
export type {
	CaptureLine,
	VerifyConfig,
	Workload
} from '../core/verification-evidence/verifyTypes';
export {
	evidenceRequested,
	recordCapture
} from '../utils/reports-media/record-capture/recordCapture';
export { buildIdentity } from '../utils/accounts-access/buildIdentity';
export type { BuiltFile } from '../utils/accounts-access/buildIdentity';
export { BuildIdentityService } from '../services/verification-evidence/BuildIdentityService';
export type {
	BuiltIdentity,
	IdentifiedBuild
} from '../services/verification-evidence/BuildIdentityService';
export { scenarioRequirements } from '../utils/verification-evidence/scenarioRequirements';
export type {
	RequiredCapture,
	ScenarioRequirements
} from '../utils/verification-evidence/scenarioRequirements';
export { mediaFacts } from '../workflows/verification-evidence/run-verify/verification-service/check-run-service/mediaFacts';
export type { MediaFacts } from '../utils/verification-evidence/mediaFacts';
export {
	comparisonContext,
	requestDigest
} from '../utils/development-tooling/comparison-context/comparisonContext';
export { comparisonDifferences } from '../services/verification-evidence/budget-service/comparisonDifferences';
export type {
	ComparisonVerdict,
	MeasuredDefinition
} from '../utils/verification-evidence/comparisonDifferences';
export { budgetFindings } from '../services/verification-evidence/budget-service/budgetFindings';
export { frozenMetrics, performanceLimit } from '../utils/verification-evidence/budgetFindings';
export type {
	BudgetBaseline,
	BudgetInput,
	PerformanceBaseline
} from '../utils/verification-evidence/budgetFindings';
export { recordIntact, sealRecord } from '../utils/verification-evidence/sealRecord';
export { PerformanceProfileService } from '../services/verification-evidence/PerformanceProfileService';
export type { ProfileInput } from '../services/verification-evidence/PerformanceProfileService';
export { TaskCompletionService } from '../services/verification-evidence/TaskCompletionService';
export type {
	TaskAudit,
	TaskAuditInput
} from '../services/verification-evidence/TaskCompletionService';
