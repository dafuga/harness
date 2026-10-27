#!/usr/bin/env bun
import { runProgram } from './cli/program';

await runProgram();
export { registerCodexCommand } from './cli/program/CodexCommand';
export { ClaudeGatewayAdapter } from './cli/program/codex-gateway-service/ClaudeGatewayAdapter';
export { CodexGatewayService } from './cli/program/codex-gateway-service/CodexGatewayService';
export { CodexResponsesSerializer } from './serializers/agents-providers/CodexResponsesSerializer';
export { CodexRequestValidator } from './validators/agents-providers/CodexRequestValidator';
export { CodexSessionRepository } from './cli/program/codex-gateway-service/codex-session-repository/CodexSessionRepository';
export { GatewayEventsService } from './serializers/agents-providers/claude-tools-serializer/GatewayEventsService';
export { ClaudeQueryService } from './services/claude-query-service/ClaudeQueryService';
export { ClaudeToolsSerializer } from './serializers/agents-providers/claude-tools-serializer/ClaudeToolsSerializer';
export { gatewayPrompt } from './cli/program/codex-gateway-service/claude-query-service/gatewayPrompt';
export type { GatewayRequest, GatewaySession } from './utils/development-tooling/gatewayTypes';
export { gatewayOptions } from './cli/program/codex-gateway-service/claude-query-service/gatewayOptions';
export { gatewayStream } from './cli/program/codex-gateway-service/gatewayStream';
export { gatewayReplay } from './cli/program/codex-gateway-service/gatewayReplay';
export { gatewayToolDefinitions } from './utils/development-tooling/gatewayToolDefinitions';
export { CpuProcessAdapter } from './services/development-tooling/cpu-usage-service/cpu-process-adapter/CpuProcessAdapter';
export { CpuUsageService } from './services/development-tooling/cpu-usage-service/CpuUsageService';
export { cpuMetrics } from './services/development-tooling/cpu-usage-service/cpuMetrics';
export { cpuProcesses } from './services/development-tooling/cpu-usage-service/cpu-process-adapter/cpuProcesses';
export { ProviderSwitchService } from './services/agents-providers/ProviderSwitchService';
export { ProviderSwitchRepository } from './repositories/agents-providers/ProviderSwitchRepository';
export { ProviderCatalogAdapter } from './adapters/agents-providers/ProviderCatalogAdapter';
export { CodexPickerMcpService } from './services/agents-providers/CodexPickerMcpService';
export type { PickerSnapshot, SessionControl, SwitchRequest } from './core/pickerTypes';
export { pickerPaths } from './cli/program/codex-picker-command/pickerPaths';
export { pickerMcpTools } from './utils/development-tooling/pickerMcpTools';
export { PickerPreviewService } from './cli/program/codex-picker-command/PickerPreviewService';
export { registerCodexPickerCommand } from './cli/program/codex-picker-command/CodexPickerCommand';
export type { PickerModel, ProviderSelection } from './core/development-tooling/pickerModelTypes';
export { ProviderSwitchApplyService } from './services/agents-providers/ProviderSwitchApplyService';
export { GatewayContentSerializer } from './serializers/development-tooling/GatewayContentSerializer';
export { GatewayImageValidator } from './validators/development-tooling/GatewayImageValidator';
export { gatewayMessages } from './cli/program/codex-gateway-service/claude-query-service/gatewayMessages';
export { gatewayContentError } from './utils/development-tooling/gatewayContentError';
export { DesktopExperimentService } from '../scripts/prepare-desktop-experiment/DesktopExperimentService';
export { NativePickerBridgeService } from './services/development-tooling/native-picker-bridge-service/NativePickerBridgeService';
export { DesktopArchiveAdapter } from '../scripts/prepare-desktop-experiment/DesktopArchiveAdapter';
export { NativePickerSwitchService } from './services/development-tooling/native-picker-bridge-service/NativePickerSwitchService';
export { pickerProvider } from './utils/development-tooling/nativePickerProtocol';
export { desktopPatchConfig } from './configs/development-tooling/desktopPatchConfig';
export { DesktopIntegrityAdapter } from '../scripts/prepare-desktop-experiment/DesktopIntegrityAdapter';
export { NativePickerDefaultsService } from './services/development-tooling/native-picker-bridge-service/NativePickerDefaultsService';
export { NativePickerIdleValidator } from './validators/development-tooling/NativePickerIdleValidator';
export { explorerRoute } from './utils/explorer-ui/explorerRoute';
export { explorerLegacy } from './utils/projects-sessions/console-canonical/explorerLegacy';
export { revisionChanges } from './cli/program/history-index-service/revisionChanges';
export { writingLimits } from './utils/git-source-history/writing-limits/writingLimits';
export { commitMessage } from './services/git-source-history/commit-message-service/commitMessage';
export { CommitMessageService } from './services/git-source-history/commit-message-service/CommitMessageService';
export { revisionReasons } from './utils/development-tooling/revisionReasons';
export { verificationNoteIdentity } from './utils/verification-evidence/verificationNoteIdentity';
export { previewBinding } from './utils/development-tooling/previewBinding';
export { readTreeTexts } from './utils/development-tooling/readTreeTexts';
export { bugRepairPolicy } from './utils/development-tooling/bugRepairPolicy';
export { RegressionProofService } from './workflows/verification-evidence/record-regression/RegressionProofService';
export { RegressionProofRepository } from './repositories/verification-evidence/RegressionProofRepository';
export { regressionFiles } from './utils/verification-evidence/regressionFiles';
export { regressionRecordSchema } from './core/verification-evidence/regressionTypes';
export { recordRegression } from './workflows/verification-evidence/record-regression/recordRegression';
export { regressionHistory } from './utils/git-source-history/regressionHistory';
export { unitDocumentation } from './utils/explorer-ui/unit-documentation/unitDocumentation';
export { unitMetadata } from './services/explorer-ui/revision-detail-service/unitMetadata';
export { helperScopes } from './utils/development-tooling/helperScopes';
export { helperTemplates } from './services/explorer-ui/revision-detail-service/helperTemplates';
export { helperReferences } from './services/explorer-ui/revision-detail-service/helperReferences';
export { helperConsumers } from './services/explorer-ui/revision-detail-service/helperConsumers';
export { SqliteAdapter } from './adapters/development-tooling/SqliteAdapter';
export { CatalogRepository } from './repositories/git-source-history/CatalogRepository';
export { CatalogIndexService } from './services/git-source-history/CatalogIndexService';
export { CatalogEntity } from './models/git-source-history/CatalogEntity';
export type {
	CatalogEntityAttributes,
	CatalogEntityCreateInput,
	CatalogEntityUpdateInput
} from './models/git-source-history/CatalogEntity.types';
export { createSqliteAdapter } from './models/adapters/sqlite';
export { CatalogRevision } from './models/git-source-history/CatalogRevision';
export type {
	CatalogRevisionAttributes,
	CatalogRevisionCreateInput,
	CatalogRevisionUpdateInput
} from './models/git-source-history/CatalogRevision.types';
export { CatalogRevisionEntity } from './models/git-source-history/CatalogRevisionEntity';
export type {
	CatalogRevisionEntityAttributes,
	CatalogRevisionEntityCreateInput,
	CatalogRevisionEntityUpdateInput
} from './models/git-source-history/CatalogRevisionEntity.types';
export { CatalogDependency } from './models/git-source-history/CatalogDependency';
export type {
	CatalogDependencyAttributes,
	CatalogDependencyCreateInput,
	CatalogDependencyUpdateInput
} from './models/git-source-history/CatalogDependency.types';
export { CatalogBranch } from './models/git-source-history/CatalogBranch';
export type {
	CatalogBranchAttributes,
	CatalogBranchCreateInput,
	CatalogBranchUpdateInput
} from './models/git-source-history/CatalogBranch.types';
export { CatalogRecord } from './models/git-source-history/CatalogRecord';
export type {
	CatalogRecordAttributes,
	CatalogRecordCreateInput,
	CatalogRecordUpdateInput
} from './models/git-source-history/CatalogRecord.types';
export { CatalogMetadata } from './models/git-source-history/CatalogMetadata';
export type {
	CatalogMetadataAttributes,
	CatalogMetadataCreateInput,
	CatalogMetadataUpdateInput
} from './models/git-source-history/CatalogMetadata.types';
export { AnalyticsEvent } from './models/reports-media/AnalyticsEvent';
export type {
	AnalyticsEventAttributes,
	AnalyticsEventCreateInput,
	AnalyticsEventUpdateInput
} from './models/reports-media/AnalyticsEvent.types';
export { ProviderSwitch } from './models/agents-providers/ProviderSwitch';
export type {
	ProviderSwitchAttributes,
	ProviderSwitchCreateInput,
	ProviderSwitchUpdateInput
} from './models/agents-providers/ProviderSwitch.types';
export { CatalogWriteService } from './services/git-source-history/CatalogWriteService';
export { CatalogScenario } from './models/git-source-history/CatalogScenario';
export type {
	CatalogScenarioAttributes,
	CatalogScenarioCreateInput,
	CatalogScenarioUpdateInput
} from './models/git-source-history/CatalogScenario.types';
export { ModelDependencyService } from './services/development-tooling/ModelDependencyService';
export { registerBenchmarkCommand } from './cli/program/BenchmarkCommand';
export { CodexBenchmarkAdapter } from './cli/program/benchmark-service/benchmark-definition/CodexBenchmarkAdapter';
export { ClaudeBenchmarkAdapter } from './cli/program/benchmark-service/benchmark-definition/ClaudeBenchmarkAdapter';
export { BenchmarkDefinitionValidator } from './cli/program/benchmark-service/benchmark-definition/BenchmarkDefinitionValidator';
export { BenchmarkRepository } from './repositories/agents-providers/BenchmarkRepository';
export { BenchmarkService } from './cli/program/benchmark-service/BenchmarkService';
export { registerResourcesCommand } from './cli/program/ResourcesCommand';
export { ResourceQueueService } from './services/execution-runtimes/ResourceQueueService';
export { TaskCompletionService } from './services/verification-evidence/TaskCompletionService';
export { PerformanceProfileService } from './services/verification-evidence/PerformanceProfileService';
export { registerTaskCommand } from './cli/program/TaskCommand';
export { PerformanceEvidenceValidator } from './validators/verification-evidence/PerformanceEvidenceValidator';
export { SourceProfileAdapter } from './adapters/verification-evidence/source-profile-adapter/SourceProfileAdapter';
export { ApiCommand } from './commands/networking-security/ApiCommand';
export { HarnessApiService } from './services/networking-security/HarnessApiService';
export { HarnessHttpAdapter } from './adapters/networking-security/HarnessHttpAdapter';
export { ModuleTaskCommand } from './commands/agents-providers/ModuleTaskCommand';
export { ModuleTaskRepository } from './repositories/agents-providers/ModuleTaskRepository';
export { ModuleTaskService } from './services/agents-providers/ModuleTaskService';
export { ModuleTaskRunnerAdapter } from './adapters/agents-providers/ModuleTaskRunnerAdapter';
export { ModuleTaskWorkerService } from './services/agents-providers/ModuleTaskWorkerService';
export { ModuleTaskAnalyticsService } from './services/agents-providers/ModuleTaskAnalyticsService';
export { ModuleTaskWorktreeAdapter } from './adapters/agents-providers/ModuleTaskWorktreeAdapter';
export { ValidateCommand } from './commands/development-tooling/ValidateCommand';
export { ModuleDataService } from './services/git-source-history/ModuleDataService';
export { ModuleDataRepository } from './repositories/git-source-history/ModuleDataRepository';
export { ModuleDataValidator } from './validators/development-tooling/ModuleDataValidator';
export { formatModuleDataFailure } from './helpers/git-source-history/formatModuleDataFailure';
export { ModuleDataSnapshotValidator } from './validators/development-tooling/ModuleDataSnapshotValidator';
export { ModuleDataReviewRepository } from './repositories/git-source-history/ModuleDataReviewRepository';
export { ModuleDataSourceAdapter } from './adapters/git-source-history/ModuleDataSourceAdapter';
export { moduleScenarioReviews } from './utils/git-source-history/moduleScenarioReviews';
export { ModuleTaskServerService } from './services/agents-providers/ModuleTaskServerService';
export { ModuleTaskSandboxAdapter } from './adapters/agents-providers/ModuleTaskSandboxAdapter';

export { TestContractService } from './services/verification-evidence/TestContractService';
export { TestCaseValidator } from './validators/verification-evidence/TestCaseValidator';
export { TestDiscoveryService } from './services/verification-evidence/TestDiscoveryService';
export { TestExpectationService } from './services/verification-evidence/TestExpectationService';
export { TestArtifactService } from './services/verification-evidence/TestArtifactService';
export { CaseResultAdapter } from './adapters/verification-evidence/CaseResultAdapter';
export { ModuleCatalogService } from './services/module-system/ModuleCatalogService';
export { ModuleCommand } from './commands/module-system/ModuleCommand';
export { ModuleInstallService } from './services/module-system/ModuleInstallService';
export { ModuleResourceService } from './services/module-system/ModuleResourceService';
export type {
	ModuleDefinition,
	ModuleResource,
	ModuleState,
	ModuleCatalog
} from './services/module-system/moduleDefinition.types';
export { moduleDefinitionSchema } from './services/module-system/moduleDefinition';
export { ModuleScaffoldService } from './services/module-system/ModuleScaffoldService';
export { ModulePackageService } from './services/module-system/ModulePackageService';
export { standardCodeModules } from './templates/module-system/standardCodeModules';
export { rustWasmModule } from './templates/module-system/rustWasmModule';
export { rustBackendModule } from './templates/module-system/rustBackendModule';
export { moduleResourceLocation } from './helpers/module-system/moduleResourceLocation';
export { PermissionCatalogService } from './services/networking-security/PermissionCatalogService';
export { PermissionsCommand } from './commands/networking-security/PermissionsCommand';
export { ModuleTaskContractContextService } from './services/agents-providers/ModuleTaskContractContextService';
export { ModuleTaskLaunchAdapter } from './adapters/agents-providers/ModuleTaskLaunchAdapter';
export { ModuleTaskSandboxProcessAdapter } from './adapters/agents-providers/ModuleTaskSandboxProcessAdapter';
export { FeaturePlanRepository } from './repositories/agents-providers/FeaturePlanRepository';
export { FeaturePlanService } from './services/agents-providers/FeaturePlanService';
export { ModuleTaskProviderConfigAdapter } from './adapters/agents-providers/ModuleTaskProviderConfigAdapter';
export { FeaturePlanValidator } from './validators/agents-providers/FeaturePlanValidator';
export { FeaturePlanReadinessAdapter } from './adapters/agents-providers/FeaturePlanReadinessAdapter';
export { FeaturePlanCommand } from './commands/agents-providers/FeaturePlanCommand';
export { ModuleTaskCodexProfileAdapter } from './adapters/agents-providers/ModuleTaskCodexProfileAdapter';
export { moduleTaskApprovedSubmission } from './helpers/agents-providers/moduleTaskApprovedSubmission';
export { ModuleTaskDependencyBaseAdapter } from './adapters/agents-providers/ModuleTaskDependencyBaseAdapter';
export { FeaturePlanCoverageValidator } from './validators/agents-providers/FeaturePlanCoverageValidator';
export { moduleTaskExecution } from './helpers/agents-providers/moduleTaskExecution';
export { ModuleTaskToolBrokerAdapter } from './adapters/agents-providers/ModuleTaskToolBrokerAdapter';
export { featurePlanGraphUncertainty } from './helpers/agents-providers/featurePlanGraphUncertainty';
export { moduleTaskBrokerFiles } from './helpers/agents-providers/moduleTaskBrokerFiles';
export { moduleTaskBrokerContracts } from './helpers/agents-providers/moduleTaskBrokerContracts';
export { FeatureWorkService } from './services/agents-providers/FeatureWorkService';
export { FeaturePlanPreparationService } from './services/agents-providers/FeaturePlanPreparationService';
export { featureSpecStructure } from './helpers/development-tooling/featureSpecStructure';
export { featurePlanImage } from './utils/agents-providers/featurePlanImage';
export { featurePlanImpact } from './utils/agents-providers/featurePlanImpact';
export { ModuleTaskBrokerTransportAdapter } from './adapters/agents-providers/ModuleTaskBrokerTransportAdapter';
