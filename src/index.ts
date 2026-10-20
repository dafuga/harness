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
export { CodexGatewayService } from './services/codex-gateway-service/CodexGatewayService';
export { CodexResponsesSerializer } from './serializers/CodexResponsesSerializer';
export { CodexRequestValidator } from './validators/CodexRequestValidator';
export { CodexSessionRepository } from './repositories/codex-session-repository/CodexSessionRepository';
export { GatewayEventsService } from './services/GatewayEventsService';
export { ClaudeQueryService } from './services/claude-query-service/ClaudeQueryService';
export { ClaudeToolsSerializer } from './serializers/ClaudeToolsSerializer';
export { gatewayPrompt } from './services/claude-query-service/gatewayPrompt';
export type { GatewayRequest, GatewaySession } from './utils/gatewayTypes';
export { gatewayOptions } from './services/claude-query-service/gatewayOptions';
export { gatewayStream } from './services/codex-gateway-service/gatewayStream';
export { gatewayReplay } from './services/codex-gateway-service/gatewayReplay';
export { gatewayToolDefinitions } from './utils/gatewayToolDefinitions';
export { CpuProcessAdapter } from './adapters/cpu-process-adapter/CpuProcessAdapter';
export { CpuUsageService } from './services/cpu-usage-service/CpuUsageService';
export { cpuMetrics } from './services/cpu-usage-service/cpuMetrics';
export { cpuProcesses } from './adapters/cpu-process-adapter/cpuProcesses';
export { ProviderSwitchService } from './services/ProviderSwitchService';
export { ProviderSwitchRepository } from './repositories/ProviderSwitchRepository';
export { ProviderCatalogAdapter } from './adapters/ProviderCatalogAdapter';
export { CodexPickerMcpService } from './services/CodexPickerMcpService';
export type { PickerSnapshot, SessionControl, SwitchRequest } from './core/pickerTypes';
export { pickerPaths } from './commands/codex-picker-command/pickerPaths';
export { pickerMcpTools } from './utils/pickerMcpTools';
export { PickerPreviewService } from './services/PickerPreviewService';
export { registerCodexPickerCommand } from './commands/codex-picker-command/CodexPickerCommand';
export type { PickerModel, ProviderSelection } from './core/pickerModelTypes';
export { ProviderSwitchApplyService } from './services/ProviderSwitchApplyService';
export { GatewayContentSerializer } from './serializers/GatewayContentSerializer';
export { GatewayImageValidator } from './validators/GatewayImageValidator';
export { gatewayMessages } from './services/claude-query-service/gatewayMessages';
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
export { explorerLegacy } from './utils/console-canonical/explorerLegacy';
export { revisionChanges } from './services/history-index-service/revisionChanges';
export { writingLimits } from './utils/writing-limits/writingLimits';
export { commitMessage } from './services/commit-message-service/commitMessage';
export { CommitMessageService } from './services/commit-message-service/CommitMessageService';
export { revisionReasons } from './utils/revisionReasons';
export { verificationNoteIdentity } from './utils/verificationNoteIdentity';
export { previewBinding } from './utils/previewBinding';
export { readTreeTexts } from './utils/readTreeTexts';
export { bugRepairPolicy } from './utils/bugRepairPolicy';
export { RegressionProofService } from './services/RegressionProofService';
export { RegressionProofRepository } from './repositories/RegressionProofRepository';
export { regressionFiles } from './utils/regressionFiles';
export { regressionRecordSchema } from './core/regressionTypes';
export { recordRegression } from './workflows/record-regression/recordRegression';
export { regressionHistory } from './utils/regressionHistory';
export { unitDocumentation } from './utils/unit-documentation/unitDocumentation';
export { unitMetadata } from './services/revision-detail-service/unitMetadata';
export { helperScopes } from './utils/helperScopes';
export { helperTemplates } from './services/revision-detail-service/helperTemplates';
export { helperReferences } from './services/revision-detail-service/helperReferences';
export { helperConsumers } from './services/revision-detail-service/helperConsumers';
