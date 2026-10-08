import { expect, test } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CodexPickerMcpService, pickerResource } from '../../src/services/CodexPickerMcpService';
import { ProviderSwitchService } from '../../src/services/ProviderSwitchService';
import { createPickerFixture } from '../support/picker';

test('MCP exposes a thread panel and explicit pending switch tools, with no apply action', async () => {
	const { store, catalog, target } = createPickerFixture();
	const service = new CodexPickerMcpService(
		new ProviderSwitchService(store, catalog),
		'<html>Panel fixture</html>'
	);
	const [host, server] = InMemoryTransport.createLinkedPair();
	const client = new Client({ name: 'test-host', version: '1' });
	await service.server.connect(server);
	await client.connect(host);
	try {
		const tools = await client.listTools();
		expect(tools.tools.find((t) => t.name === 'open_model_picker')?._meta?.['openai/ui']).toEqual({
			entrypoints: [{ type: 'thread' }]
		});
		expect(tools.tools.some((t) => /apply|resume/.test(t.name))).toBe(false);
		const html = await client.readResource({ uri: pickerResource });
		expect(html.contents[0]).toMatchObject({
			mimeType: 'text/html;profile=mcp-app',
			text: '<html>Panel fixture</html>'
		});
		const opened = await client.callTool({ name: 'open_model_picker', arguments: {} });
		expect(opened.structuredContent).toMatchObject({
			sessionId: null,
			active: null,
			defaultProvider: 'openai'
		});
		const queued = await client.callTool({
			name: 'request_model_switch',
			arguments: { session_id: 'session-a', ...target }
		});
		expect(queued.structuredContent).toMatchObject({
			active: null,
			request: { status: 'pending' }
		});
		const invalid = await client.callTool({
			name: 'request_model_switch',
			arguments: { session_id: 'session-a', ...target, model: 'invented' }
		});
		expect(invalid.isError).toBe(true);
	} finally {
		await client.close();
		await service.server.close();
	}
});
