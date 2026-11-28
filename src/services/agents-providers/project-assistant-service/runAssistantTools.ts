// @harness-uid u_kg5hqu7hij
import type { ClaudeBlock } from '../../../adapters/agents-providers/ClaudeMessagesAdapter';
import type { AssistantToolDefinition } from '../../../core/agents-providers/projectAssistant.types';
import { redactSecrets } from '../../../utils/agents-providers/redactSecrets';
import type { ToolInput, ToolRound } from './assistantTool.types';

function failure(id: string, content: string): ClaudeBlock {
	return { type: 'tool_result', tool_use_id: id, content, is_error: true };
}

async function runOne(
	tool: AssistantToolDefinition,
	use: { id: string; input: ToolInput },
	round: ToolRound
): Promise<ClaudeBlock> {
	round.called.push(tool.name);
	try {
		const result = await tool.run(tool.write ? redactInput(use.input) : use.input);
		round.sources.push(...result.sources);
		const content = redactSecrets(result.text).slice(0, 6000);
		return { type: 'tool_result', tool_use_id: use.id, content };
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Tool failed.';
		return failure(use.id, redactSecrets(message).slice(0, 300));
	}
}

/** Run the model's tool calls in order, refusing unknown tools and unsafe writes. */
export async function runAssistantTools(
	uses: readonly ClaudeBlock[],
	round: ToolRound
): Promise<ClaudeBlock[]> {
	const results: ClaudeBlock[] = [];
	let wrote = false;
	for (const use of uses) {
		if (use.type !== 'tool_use') continue;
		const tool = round.tools.find((candidate) => candidate.name === use.name);
		if (!tool) results.push(failure(use.id, 'Unknown or unavailable tool.'));
		else if (tool.write && (!round.firstRound || wrote || uses.length !== 1))
			results.push(
				failure(use.id, 'A write must be the only step and come straight from the request.')
			);
		else {
			wrote ||= tool.write;
			results.push(await runOne(tool, use, round));
		}
	}
	return results;
}

function redactInput(input: ToolInput): ToolInput {
	return Object.fromEntries(
		Object.entries(input).map(([key, value]) => [
			key,
			typeof value === 'string' ? redactSecrets(value) : value
		])
	);
}
