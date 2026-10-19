import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { GatewayRequest, GatewaySession } from '../utils/gatewayTypes';
import type { CodexSessionRepository } from '../repositories/CodexSessionRepository';
import { ClaudeToolsSerializer } from '../serializers/ClaudeToolsSerializer';
import { gatewayMessages } from '../utils/gatewayMessages';
import { gatewayOptions } from '../utils/gatewayOptions';

export class ClaudeQueryService {
	constructor(private readonly repository: CodexSessionRepository) {}

	private forward(message: SDKMessage, session: GatewaySession): void {
		if (message.type === 'result' && message.subtype !== 'success')
			throw new Error('Claude query failed');
		if (message.type !== 'stream_event' || message.event.type !== 'content_block_delta') return;
		if (message.event.delta.type === 'text_delta')
			session.emit?.({ type: 'text', text: message.event.delta.text });
	}

	async run(request: GatewayRequest, session: GatewaySession): Promise<void> {
		session.running = true;
		try {
			const server = new ClaudeToolsSerializer(this.repository).server(request.tools, session);
			const stream = query({
				prompt: gatewayMessages(request),
				options: {
					...gatewayOptions(session),
					systemPrompt:
						request.instructions ??
						'You are a coding assistant. Execution belongs to Codex. Use only the supplied Codex tools.',
					mcpServers: { codex: server },
					allowedTools: ['mcp__codex__*']
				}
			});
			for await (const message of stream) {
				this.forward(message, session);
			}
			session.emit?.({ type: 'done' });
		} catch {
			session.emit?.({
				type: 'error',
				message: session.controller.signal.aborted
					? 'Session cancelled'
					: 'Claude query failed; no fallback was used'
			});
			this.repository.cancel(session);
		} finally {
			session.running = false;
		}
	}
}
