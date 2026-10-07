#!/usr/bin/env bun
import { CommanderError } from 'commander';
import { commandAction } from './utils/commandAction';
import { buildProgram } from './cli/program';
import { recordAnalytics } from './workflows/analyticsRecord';
import { importAnalytics } from './workflows/importAnalytics';
import { isExpectedCliError } from './core/errors';

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
export { SessionCommand } from './commands/SessionCommand';
