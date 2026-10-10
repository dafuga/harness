/**
 * Public contract types and schemas of Harness.
 *
 * Importing this module has no side effects: it does not start the CLI or touch the file system.
 */
export {
	componentManifestSchema,
	contractItemSchema,
	dependencyVias,
	executionTargetSchema,
	performanceBudgetSchema,
	performanceMetrics,
	performanceTolerance,
	runtimeKinds,
	scenarioManifestSchema,
	unitDependencySchema,
	unitIdPattern
} from '../core/unitTypes';
export type {
	ComponentManifest,
	ContractItem,
	ExecutionTarget,
	RuntimeKind,
	ScenarioManifest,
	UnitDependency
} from '../core/unitTypes';
export {
	budgetFindingSchema,
	captureSchema,
	componentVersionSchema,
	measurementSchema,
	profileSchema,
	scenarioResultSchema,
	verificationRecordSchema
} from '../core/verificationTypes';
export type {
	BudgetFinding,
	Capture,
	Measurement,
	RecordedComponent,
	ScenarioResult,
	VerificationProfile,
	VerificationRecord
} from '../core/verificationTypes';
export { unitsConfigSchema } from '../core/unitsConfig';
export type { UnitsConfig } from '../core/unitsConfig';
export { ComponentManifestValidator } from '../validators/ComponentManifestValidator';
export type { ManifestValidation } from '../validators/ComponentManifestValidator';
export { ScenarioManifestValidator } from '../validators/ScenarioManifestValidator';
export { VerificationRecordValidator } from '../validators/VerificationRecordValidator';
export { componentVersion } from '../utils/componentVersion';
export type { ComponentVersion } from '../utils/componentVersion';
