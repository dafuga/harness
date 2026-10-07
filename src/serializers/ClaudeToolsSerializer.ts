import { gatewayToolDefinitions } from '../utils/gatewayToolDefinitions';
import { randomUUID } from 'node:crypto';
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import type { GatewayItem, GatewaySession } from '../utils/gatewayTypes';
import type { CodexSessionRepository } from '../repositories/CodexSessionRepository';
import { GatewayEventsService } from '../services/GatewayEventsService';

export class ClaudeToolsSerializer {
	private readonly events = new GatewayEventsService();
	constructor(private readonly repository: CodexSessionRepository) {}

	server(definitions: GatewayItem[], session: GatewaySession) {
		const tools = gatewayToolDefinitions(definitions).map((definition, index) =>
			this.createTool(definition, session, index)
		);
		return createSdkMcpServer({ name: 'codex', version: '0.1.0', tools });
	}

	private createTool(definition: GatewayItem, session: GatewaySession, index: number) {
		if (!['function', 'custom'].includes(String(definition.type)))
			throw new Error('Unsupported Codex tool shape');
		const name = String(definition.name);
		const custom = definition.type === 'custom';
		const json = custom
			? { type: 'object', properties: { input: { type: 'string' } }, required: ['input'] }
			: definition.parameters;
		const schema = z.fromJSONSchema(json as z.core.JSONSchema.JSONSchema) as z.ZodObject;
		return tool(
			`tool_${index}`,
			`${name}: ${String(definition.description ?? '')}`,
			schema.shape,
			async (args) => {
				const id = `call_${randomUUID()}`;
				const result = this.repository.waitForTool(session, id);
				session.emit?.({
					type: 'call',
					call: {
						id,
						name,
						custom,
						namespace: typeof definition.namespace === 'string' ? definition.namespace : undefined,
						arguments: JSON.stringify(args)
					}
				});
				this.events.finishToolBatch(session);
				return { content: [{ type: 'text' as const, text: await result }] };
			}
		);
	}
}
