// @harness-uid u_sro7kwafcj
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type {
	PlatformAdapter,
	PlatformEventHandler
} from '../../core/agents-providers/platformAdapter.types';
import type { PlatformAdapterRegistryService } from './PlatformAdapterRegistryService';

const sendInput = z.strictObject({
	channelId: z.string().min(1).max(200),
	text: z.string().min(1).max(4000),
	threadId: z.string().min(1).max(200).optional(),
	blocks: z.array(z.record(z.string(), z.json())).min(1).max(50).optional()
});

/** Binds one pre-authorized installation to the host's agent and MCP session. */
export class PlatformMessagingService {
	private readonly adapter: PlatformAdapter;

	constructor(registry: PlatformAdapterRegistryService, platform: string, installationId: string) {
		this.adapter = registry.resolve(platform, installationId);
	}

	registerMcpTools(server: McpServer): void {
		server.registerTool(
			'platform_identity',
			{
				description:
					'Get the workspace and bot identity for this agent’s installed messaging adapter.',
				annotations: { readOnlyHint: true, openWorldHint: true }
			},
			async () => {
				try {
					return toolResult({ ...(await this.adapter.identity()) });
				} catch {
					return toolResult({ status: 'unavailable' }, true);
				}
			}
		);
		server.registerTool(
			'platform_send_message',
			{
				description:
					'Send a message to an approved channel. Supply threadId to reply in a thread. Reconcile unknown delivery before trying again.',
				inputSchema: sendInput,
				annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: true }
			},
			async (input) => {
				try {
					const result = await this.adapter.send(input);
					return toolResult(result, result.status !== 'sent');
				} catch {
					return toolResult({ status: 'unknown', code: 'delivery-unknown' }, true);
				}
			}
		);
	}

	subscribe(handler: PlatformEventHandler, signal: AbortSignal): Promise<void> {
		return this.adapter.subscribe(handler, signal);
	}
}

function toolResult(data: Record<string, unknown>, isError = false): CallToolResult {
	return {
		content: [{ type: 'text', text: JSON.stringify(data) }],
		structuredContent: data,
		...(isError ? { isError: true } : {})
	};
}
