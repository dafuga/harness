/**
 * Public verification contracts of Harness: reasons, budgets, the evidence protocol and the
 * rules that judge them. Importing this module has no side effects.
 */
export { explanationOutcomes, explanationSchema } from '../core/explanationTypes';
export type {
	Explanation,
	ExplanationOutcome,
	ReasonStatus,
	RequiredReason
} from '../core/explanationTypes';
export {
	comparisonSchema,
	measurementBoundaries,
	metricUnits,
	roundsProtocol
} from '../core/comparisonTypes';
export type { Comparison } from '../core/comparisonTypes';
export { budgetEventSchema, performanceBaselineSchema } from '../core/budgetTypes';
export type { BudgetEvent, PerformanceBaselineEntry } from '../core/budgetTypes';
export {
	captureIndex,
	benchmarkCaptureSchema,
	captureLineSchema,
	defaultVerifyConfig,
	reportedMeasurementSchema,
	verifyConfigSchema,
	workloadSchema
} from '../core/verifyTypes';
export type { CaptureLine, VerifyConfig, Workload } from '../core/verifyTypes';
export { evidenceRequested, recordCapture } from '../utils/recordCapture';
export { buildIdentity } from '../utils/buildIdentity';
export type { BuiltFile } from '../utils/buildIdentity';
export { BuildIdentityService } from '../services/BuildIdentityService';
export type { BuiltIdentity, IdentifiedBuild } from '../services/BuildIdentityService';
export { scenarioRequirements } from '../utils/scenarioRequirements';
export type { RequiredCapture, ScenarioRequirements } from '../utils/scenarioRequirements';
export { mediaFacts } from '../utils/mediaFacts';
export type { MediaFacts } from '../utils/mediaFacts';
export { comparisonContext, requestDigest } from '../utils/comparisonContext';
export { comparisonDifferences } from '../utils/comparisonDifferences';
export type { ComparisonVerdict, MeasuredDefinition } from '../utils/comparisonDifferences';
export { budgetFindings, frozenMetrics, performanceLimit } from '../utils/budgetFindings';
export type { BudgetBaseline, BudgetInput, PerformanceBaseline } from '../utils/budgetFindings';
export { recordIntact, sealRecord } from '../utils/sealRecord';
