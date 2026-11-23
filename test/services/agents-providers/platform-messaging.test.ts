import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { expect, test, vi } from 'vitest';
import type { PlatformAdapter } from '../../../src/core/agents-providers/platformAdapter.types';
import { PlatformAdapterRegistryService } from '../../../src/services/agents-providers/PlatformAdapterRegistryService';
import { PlatformMessagingService } from '../../../src/services/agents-providers/PlatformMessagingService';

test('exposes an installation-bound MCP surface and forwards the host subscription', async () => {
	const adapter: PlatformAdapter = {
		identity: vi.fn().mockResolvedValue({ workspaceId: 'TAPP', botId: 'BBOT', botUserId: 'UBOT' }),
		send: vi.fn().mockResolvedValue({
			status: 'sent',
			requestId: 'request',
			auditRecorded: true,
			receipt: { channelId: 'CTEST', messageId: '2.0' }
		}),
		subscribe: vi.fn().mockResolvedValue(undefined)
	};
	const registry = new PlatformAdapterRegistryService();
	registry.register('slack', 'primary', adapter);
	const service = new PlatformMessagingService(registry, 'slack', 'primary');
	const server = new McpServer({ name: 'fixture-server', version: '0.1.0' });
	const client = new Client({ name: 'fixture-agent', version: '0.1.0' });
	service.registerMcpTools(server);
	const [caller, host] = InMemoryTransport.createLinkedPair();

	try {
		await server.connect(host);
		await client.connect(caller);
		const tools = await client.listTools();
		expect(tools.tools.map(({ name }) => name)).toEqual([
			'platform_identity',
			'platform_send_message'
		]);
		const message = { channelId: 'CTEST', text: 'a reply', threadId: '1.0' };
		const sent = await client.callTool({ name: 'platform_send_message', arguments: message });
		expect(sent.structuredContent).toEqual({
			status: 'sent',
			requestId: 'request',
			auditRecorded: true,
			receipt: { channelId: 'CTEST', messageId: '2.0' }
		});
		expect(adapter.send).toHaveBeenCalledExactlyOnceWith(message);

		const changeBinding = await client.callTool({
			name: 'platform_send_message',
			arguments: { ...message, installationId: 'another-installation' }
		});
		expect(changeBinding.isError).toBe(true);
		expect(adapter.send).toHaveBeenCalledTimes(1);

		const handler = vi.fn();
		const signal = new AbortController().signal;
		await service.subscribe(handler, signal);
		expect(adapter.subscribe).toHaveBeenCalledExactlyOnceWith(handler, signal);
	} finally {
		await client.close();
		await server.close();
	}
});
