// @harness-uid u_kg5hqg2wxy
import { ProjectAssistantError } from '../../core/agents-providers/ProjectAssistantError';
import type {
	ClaudeBlock,
	ClaudeMessage,
	ClaudeMessagesAdapterConfig,
	ClaudeToolSpec,
	ClaudeTurn
} from './ClaudeMessagesAdapter.types';

/** One Anthropic Messages API turn with tool definitions. The caller owns the loop. */
export class ClaudeMessagesAdapter {
	constructor(private readonly config: ClaudeMessagesAdapterConfig) {}

	async turn(
		system: string,
		messages: readonly ClaudeMessage[],
		tools: readonly ClaudeToolSpec[]
	): Promise<ClaudeTurn> {
		const call = this.config.fetch ?? fetch;
		const response = await this.config.withKey((apiKey) =>
			call('https://api.anthropic.com/v1/messages', {
				method: 'POST',
				redirect: 'error',
				signal: AbortSignal.timeout(60_000),
				headers: {
					'content-type': 'application/json',
					'anthropic-version': '2023-06-01',
					'x-api-key': apiKey
				},
				body: JSON.stringify({
					model: this.config.model,
					max_tokens: this.config.maxTokens,
					system,
					tools,
					messages
				})
			})
		);
		if (!response.ok)
			throw new ProjectAssistantError(`Claude request refused with status ${response.status}.`);
		const body = (await response.json()) as { stop_reason?: unknown; content?: unknown };
		if (!Array.isArray(body.content))
			throw new ProjectAssistantError('Claude reply was malformed.');
		return {
			stopReason: typeof body.stop_reason === 'string' ? body.stop_reason : 'unknown',
			content: body.content.filter(isKnownBlock)
		};
	}
}

function isKnownBlock(block: unknown): block is ClaudeBlock {
	if (!block || typeof block !== 'object' || !('type' in block)) return false;
	return block.type === 'text' || block.type === 'tool_use';
}

export type {
	ClaudeBlock,
	ClaudeMessage,
	ClaudeMessagesAdapterConfig,
	ClaudeToolSpec,
	ClaudeTurn
} from './ClaudeMessagesAdapter.types';
