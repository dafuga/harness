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
export { registerCodexCommand } from './cli/program/CodexCommand';
export { ClaudeGatewayAdapter } from './cli/program/codex-gateway-service/ClaudeGatewayAdapter';
export { CodexGatewayService } from './cli/program/codex-gateway-service/CodexGatewayService';
export { CodexResponsesSerializer } from './serializers/CodexResponsesSerializer';
export { CodexRequestValidator } from './validators/CodexRequestValidator';
export { CodexSessionRepository } from './cli/program/codex-gateway-service/codex-session-repository/CodexSessionRepository';
export { GatewayEventsService } from './serializers/claude-tools-serializer/GatewayEventsService';
export { ClaudeQueryService } from './services/claude-query-service/ClaudeQueryService';
export { ClaudeToolsSerializer } from './serializers/claude-tools-serializer/ClaudeToolsSerializer';
export { gatewayPrompt } from './cli/program/codex-gateway-service/claude-query-service/gatewayPrompt';
export type { GatewayRequest, GatewaySession } from './utils/gatewayTypes';
export { gatewayOptions } from './cli/program/codex-gateway-service/claude-query-service/gatewayOptions';
export { gatewayStream } from './cli/program/codex-gateway-service/gatewayStream';
export { gatewayReplay } from './cli/program/codex-gateway-service/gatewayReplay';
export { gatewayToolDefinitions } from './utils/gatewayToolDefinitions';
export { CpuProcessAdapter } from './services/cpu-usage-service/cpu-process-adapter/CpuProcessAdapter';
export { CpuUsageService } from './services/cpu-usage-service/CpuUsageService';
export { cpuMetrics } from './services/cpu-usage-service/cpuMetrics';
export { cpuProcesses } from './services/cpu-usage-service/cpu-process-adapter/cpuProcesses';
export { ProviderSwitchService } from './services/ProviderSwitchService';
export { ProviderSwitchRepository } from './repositories/ProviderSwitchRepository';
export { ProviderCatalogAdapter } from './adapters/ProviderCatalogAdapter';
export { CodexPickerMcpService } from './services/CodexPickerMcpService';
export type { PickerSnapshot, SessionControl, SwitchRequest } from './core/pickerTypes';
export { pickerPaths } from './cli/program/codex-picker-command/pickerPaths';
export { pickerMcpTools } from './utils/pickerMcpTools';
export { PickerPreviewService } from './cli/program/codex-picker-command/PickerPreviewService';
export { registerCodexPickerCommand } from './cli/program/codex-picker-command/CodexPickerCommand';
export type { PickerModel, ProviderSelection } from './core/pickerModelTypes';
export { ProviderSwitchApplyService } from './services/ProviderSwitchApplyService';
export { GatewayContentSerializer } from './serializers/GatewayContentSerializer';
export { GatewayImageValidator } from './validators/GatewayImageValidator';
export { gatewayMessages } from './cli/program/codex-gateway-service/claude-query-service/gatewayMessages';
export { gatewayContentError } from './utils/gatewayContentError';
export { DesktopExperimentService } from '../scripts/prepare-desktop-experiment/DesktopExperimentService';
export { NativePickerBridgeService } from './services/native-picker-bridge-service/NativePickerBridgeService';
export { DesktopArchiveAdapter } from '../scripts/prepare-desktop-experiment/DesktopArchiveAdapter';
export { NativePickerSwitchService } from './services/native-picker-bridge-service/NativePickerSwitchService';
export { pickerProvider } from './utils/nativePickerProtocol';
export { desktopPatchConfig } from './config/desktopPatchConfig';
export { DesktopIntegrityAdapter } from '../scripts/prepare-desktop-experiment/DesktopIntegrityAdapter';
export { NativePickerDefaultsService } from './services/native-picker-bridge-service/NativePickerDefaultsService';
export { NativePickerIdleValidator } from './validators/NativePickerIdleValidator';
export { explorerRoute } from './utils/explorerRoute';
export { explorerLegacy } from './utils/console-canonical/explorerLegacy';
export { revisionChanges } from './cli/program/history-index-service/revisionChanges';
export { writingLimits } from './utils/writing-limits/writingLimits';
export { commitMessage } from './services/commit-message-service/commitMessage';
export { CommitMessageService } from './services/commit-message-service/CommitMessageService';
export { revisionReasons } from './utils/revisionReasons';
export { verificationNoteIdentity } from './utils/verificationNoteIdentity';
export { previewBinding } from './utils/previewBinding';
export { readTreeTexts } from './utils/readTreeTexts';
export { bugRepairPolicy } from './utils/bugRepairPolicy';
export { RegressionProofService } from './workflows/record-regression/RegressionProofService';
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
