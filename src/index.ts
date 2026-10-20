#!/usr/bin/env bun
import { CommanderError } from 'commander';
import { commandAction } from './utils/commandAction';
import { buildProgram } from './cli/program';
import { recordAnalytics } from './workflows/analyticsRecord';
import { importAnalytics } from './workflows/importAnalytics';
import { beatFromEnvironment } from './workflows/runActivity';
import { isExpectedCliError } from './core/errors';
import { pipedOutput } from './utils/pipedOutput';

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
export { registerCodexCommand } from './commands/CodexCommand';
export { ClaudeGatewayAdapter } from './adapters/ClaudeGatewayAdapter';
export { CodexGatewayService } from './services/CodexGatewayService';
export { CodexResponsesSerializer } from './serializers/CodexResponsesSerializer';
export { CodexRequestValidator } from './validators/CodexRequestValidator';
export { CodexSessionRepository } from './repositories/CodexSessionRepository';
export { GatewayEventsService } from './services/GatewayEventsService';
export { ClaudeQueryService } from './services/ClaudeQueryService';
export { ClaudeToolsSerializer } from './serializers/ClaudeToolsSerializer';
export { gatewayPrompt } from './utils/gatewayPrompt';
export type { GatewayRequest, GatewaySession } from './utils/gatewayTypes';
export { gatewayOptions } from './utils/gatewayOptions';
export { gatewayStream } from './utils/gatewayStream';
export { gatewayReplay } from './utils/gatewayReplay';
export { gatewayToolDefinitions } from './utils/gatewayToolDefinitions';
export { CpuProcessAdapter } from './adapters/CpuProcessAdapter';
export { CpuUsageService } from './services/CpuUsageService';
export { cpuMetrics } from './utils/cpuMetrics';
export { cpuProcesses } from './utils/cpuProcesses';
export { ProviderSwitchService } from './services/ProviderSwitchService';
export { ProviderSwitchRepository } from './repositories/ProviderSwitchRepository';
export { ProviderCatalogAdapter } from './adapters/ProviderCatalogAdapter';
export { CodexPickerMcpService } from './services/CodexPickerMcpService';
export type { PickerSnapshot, SessionControl, SwitchRequest } from './core/pickerTypes';
export { pickerPaths } from './utils/pickerPaths';
export { pickerMcpTools } from './utils/pickerMcpTools';
export { PickerPreviewService } from './services/PickerPreviewService';
export { registerCodexPickerCommand } from './commands/CodexPickerCommand';
export type { PickerModel, ProviderSelection } from './core/pickerModelTypes';
export { ProviderSwitchApplyService } from './services/ProviderSwitchApplyService';
export { GatewayContentSerializer } from './serializers/GatewayContentSerializer';
export { GatewayImageValidator } from './validators/GatewayImageValidator';
export { gatewayMessages } from './utils/gatewayMessages';
export { gatewayContentError } from './utils/gatewayContentError';
export { DesktopExperimentService } from './services/DesktopExperimentService';
export { NativePickerBridgeService } from './services/NativePickerBridgeService';
export { DesktopArchiveAdapter } from './adapters/DesktopArchiveAdapter';
export { NativePickerSwitchService } from './services/NativePickerSwitchService';
export { pickerProvider } from './utils/nativePickerProtocol';
export { desktopPatchConfig } from './config/desktopPatchConfig';
export { DesktopIntegrityAdapter } from './adapters/DesktopIntegrityAdapter';
export { NativePickerDefaultsService } from './services/NativePickerDefaultsService';
export { NativePickerIdleValidator } from './validators/NativePickerIdleValidator';
export { explorerRoute } from './utils/explorerRoute';
export { explorerLegacy } from './utils/explorerLegacy';
export { revisionChanges } from './utils/revisionChanges';
export { writingLimits } from './utils/writingLimits';
export { commitMessage } from './utils/commitMessage';
export { CommitMessageService } from './services/CommitMessageService';
export { revisionReasons } from './utils/revisionReasons';
export { verificationNoteIdentity } from './utils/verificationNoteIdentity';
export { bugRepairPolicy } from './utils/bugRepairPolicy';
export { SqliteAdapter } from './adapters/SqliteAdapter';
export { CatalogRepository } from './repositories/CatalogRepository';
export { CatalogIndexService } from './services/CatalogIndexService';
export { CatalogEntity } from './models/CatalogEntity';
export type {
	CatalogEntityAttributes,
	CatalogEntityCreateInput,
	CatalogEntityUpdateInput
} from './models/CatalogEntity.types';
export { createSqliteAdapter } from './models/adapters/sqlite';
export { CatalogRevision } from './models/CatalogRevision';
export type {
	CatalogRevisionAttributes,
	CatalogRevisionCreateInput,
	CatalogRevisionUpdateInput
} from './models/CatalogRevision.types';
export { CatalogRevisionEntity } from './models/CatalogRevisionEntity';
export type {
	CatalogRevisionEntityAttributes,
	CatalogRevisionEntityCreateInput,
	CatalogRevisionEntityUpdateInput
} from './models/CatalogRevisionEntity.types';
export { CatalogDependency } from './models/CatalogDependency';
export type {
	CatalogDependencyAttributes,
	CatalogDependencyCreateInput,
	CatalogDependencyUpdateInput
} from './models/CatalogDependency.types';
export { CatalogBranch } from './models/CatalogBranch';
export type {
	CatalogBranchAttributes,
	CatalogBranchCreateInput,
	CatalogBranchUpdateInput
} from './models/CatalogBranch.types';
export { CatalogRecord } from './models/CatalogRecord';
export type {
	CatalogRecordAttributes,
	CatalogRecordCreateInput,
	CatalogRecordUpdateInput
} from './models/CatalogRecord.types';
export { CatalogMetadata } from './models/CatalogMetadata';
export type {
	CatalogMetadataAttributes,
	CatalogMetadataCreateInput,
	CatalogMetadataUpdateInput
} from './models/CatalogMetadata.types';
export { AnalyticsEvent } from './models/AnalyticsEvent';
export type {
	AnalyticsEventAttributes,
	AnalyticsEventCreateInput,
	AnalyticsEventUpdateInput
} from './models/AnalyticsEvent.types';
export { ProviderSwitch } from './models/ProviderSwitch';
export type {
	ProviderSwitchAttributes,
	ProviderSwitchCreateInput,
	ProviderSwitchUpdateInput
} from './models/ProviderSwitch.types';
export { CatalogWriteService } from './services/CatalogWriteService';
export { CatalogScenario } from './models/CatalogScenario';
export type {
	CatalogScenarioAttributes,
	CatalogScenarioCreateInput,
	CatalogScenarioUpdateInput
} from './models/CatalogScenario.types';
export { ModelDependencyService } from './services/ModelDependencyService';
