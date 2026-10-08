import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	registerAppTool,
	registerAppResource,
	RESOURCE_MIME_TYPE
} from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ProviderSwitchService } from './ProviderSwitchService';
import {
	pickerMcpTools,
	pickerSessionSchema,
	pickerSwitchSchema,
	pickerCancelSchema
} from '../utils/pickerMcpTools';

export const pickerResource = 'ui://harness-claude/model-picker';

export class CodexPickerMcpService {
	readonly server = new McpServer({ name: 'harness-claude-picker', version: '0.1.0' });
	constructor(
		private readonly service: ProviderSwitchService,
		html: string
	) {
		registerAppResource(this.server, 'model-picker', pickerResource, {}, async () => ({
			contents: [
				{
					uri: pickerResource,
					mimeType: RESOURCE_MIME_TYPE,
					text: html,
					_meta: { ui: { csp: { connectDomains: [], resourceDomains: [] } } }
				}
			]
		}));
		this.register('open_model_picker', pickerSessionSchema, true, true);
		this.register('get_provider_status', pickerSessionSchema, true);
		this.register('list_models', z.object({}).strict(), true);
		this.register('list_observed_sessions', z.object({}).strict(), true);
		this.register('request_model_switch', pickerSwitchSchema, false);
		this.register('cancel_model_switch', pickerCancelSchema, false);
	}

	private register(name: string, schema: z.ZodObject, readOnly: boolean, entrypoint = false): void {
		registerAppTool(
			this.server,
			name,
			{
				title: entrypoint ? 'Model picker' : name.replaceAll('_', ' '),
				inputSchema: schema,
				description:
					name === 'request_model_switch'
						? 'Queue an explicitly requested per-session provider/model change. Does not apply it or change defaults.'
						: 'Local provider picker metadata. Unknown active settings remain unknown.',
				annotations: { readOnlyHint: readOnly, destructiveHint: false, openWorldHint: false },
				_meta: {
					ui: { resourceUri: pickerResource },
					...(entrypoint ? { 'openai/ui': { entrypoints: [{ type: 'thread' }] } } : {})
				}
			},
			(input: unknown) => this.call(name, input)
		);
	}

	private async call(name: string, input: unknown): Promise<CallToolResult> {
		try {
			const data = await pickerMcpTools(this.service, name, input);
			return {
				content: [{ type: 'text', text: JSON.stringify(data) }],
				structuredContent: { ...data }
			};
		} catch {
			return {
				isError: true,
				content: [
					{
						type: 'text',
						text: 'Invalid or changed selection; refresh and use an explicit session and catalog model.'
					}
				]
			};
		}
	}

	async connect(): Promise<void> {
		await this.server.connect(new StdioServerTransport());
	}
}
