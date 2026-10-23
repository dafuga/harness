#!/usr/bin/env bun
import { CommanderError } from 'commander';
import { commandAction } from './utils/development-tooling/commandAction';
import { buildProgram } from './cli/program';
import { recordAnalytics } from './workflows/reports-media/analyticsRecord';
import { importAnalytics } from './workflows/reports-media/importAnalytics';
import { beatFromEnvironment } from './workflows/projects-sessions/runActivity';
import { isExpectedCliError } from './core/development-tooling/errors';
import { pipedOutput } from './utils/development-tooling/pipedOutput';

pipedOutput();
const startedAt = Date.now();
try {
	await buildProgram().exitOverride().parseAsync(process.argv);
} catch (error) {
	if (error instanceof CommanderError) process.exitCode = error.exitCode;
	else {
		process.exitCode = 1;
		if (isExpectedCliError(error)) console.error(`Error: ${error.message}`);
		else throw error;
	}
} finally {
	await recordAnalytics({
		kind: 'command',
		action: commandAction(process.argv.slice(2)),
		exitCode: Number(process.exitCode ?? 0),
		durationMs: Date.now() - startedAt
	});
	await beatFromEnvironment();
	if (process.argv[2] === 'loop') {
		try {
			await importAnalytics(process.cwd(), false);
		} catch {
			console.error('Warning: loop analytics could not be synchronized.');
		}
	}
}
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
export type {
	PickerSnapshot,
	SessionControl,
	SwitchRequest
} from './core/development-tooling/pickerTypes';
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
