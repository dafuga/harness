import type { ResourceContext } from '../../../../../../src/core/execution-runtimes/resourceTypes';
import type { ResourceQueueService } from '../../../../../../src/services/execution-runtimes/ResourceQueueService';
import type { AgentTurn, CliCommand } from '../../../models/agents-providers/AgentRunner.types';
import { managedAgentTurn } from '../../../utils/agents-providers/managedAgentTurn';
import { cliProcess } from '../../../utils/development-tooling/cliProcess';
import { publicCliEvents } from './publicCliEvents';
export async function claudeTurn(
	command: CliCommand,
	turn: AgentTurn,
	queue?: ResourceQueueService
) {
	return managedAgentTurn(turn, (resources) => runClaudeTurn(command, turn, resources), queue);
}
async function runClaudeTurn(command: CliCommand, turn: AgentTurn, resources: ResourceContext) {
	let actual = '',
		result: Record<string, unknown> | null = null;
	const args = [
		...command.args,
		'-p',
		'--verbose',
		'--output-format',
		'stream-json',
		'--model',
		turn.model,
		'--permission-mode',
		'bypassPermissions',
		'--no-session-persistence'
	];
	if (turn.effort) args.push('--effort', turn.effort);
	if (turn.access === 'read-only') args.push('--tools', 'Read,Glob,Grep');
	await cliProcess(
		{ ...command, args },
		{
			resources,
			cwd: turn.cwd,
			input: turn.prompt,
			signal: turn.signal,
			onLine: (line) => {
				let event: Record<string, unknown>;
				try {
					event = JSON.parse(line) as Record<string, unknown>;
				} catch {
					return;
				}
				if (event.type === 'system' && event.subtype === 'init') actual = String(event.model);
				publicCliEvents(event).forEach((text) => turn.onText(text));
				if (event.type === 'result') result = event;
				observeClaudeFiles(event, turn);
			}
		}
	);
	if (actual !== turn.model) throw new Error('Claude did not run the requested model.');
	const final = result as Record<string, unknown> | null;
	if (!final || final.is_error)
		throw new Error(String(final?.result ?? 'Claude returned no completed result.'));
	return { text: String(final.result ?? ''), model: actual };
}

function observeClaudeFiles(event: Record<string, unknown>, turn: AgentTurn): void {
	if (event.type !== 'assistant') return;
	const message = event.message as
		| { content?: { type: string; name?: string; input?: { file_path?: string } }[] }
		| undefined;
	message?.content?.forEach((part) => {
		if (
			part.type === 'tool_use' &&
			['Write', 'Edit'].includes(part.name ?? '') &&
			part.input?.file_path
		)
			turn.onFile?.(part.input.file_path);
	});
}
