import { expect, test, vi, beforeEach } from 'vitest';
import { CodexGatewayService } from '../src/services/CodexGatewayService';

const seen = vi.hoisted(() => ({ prompts: [] as unknown[], results: [] as unknown[], calls: 0 }));
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
	tool: (_name: string, _description: string, _schema: unknown, handler: () => unknown) => ({
		handler
	}),
	createSdkMcpServer: (config: unknown) => config,
	query: async function* ({
		prompt,
		options
	}: {
		prompt: unknown;
		options: {
			mcpServers: { codex: { tools: { handler: (args: object) => Promise<unknown> }[] } };
		};
	}) {
		seen.calls++;
		if (typeof prompt === 'string') seen.prompts.push(prompt);
		else for await (const message of prompt as AsyncIterable<unknown>) seen.prompts.push(message);
		for (const tool of options.mcpServers.codex.tools) seen.results.push(await tool.handler({}));
		yield {
			type: 'stream_event',
			event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'image processed' } }
		};
		yield { type: 'result', subtype: 'success' };
	}
}));
const png =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
const image = {
	type: 'input_image',
	image_url: `data:image/png;base64,${png}`,
	detail: 'original'
};
const imageBlock = {
	type: 'image',
	source: { type: 'base64', media_type: 'image/png', data: png }
};
const toolImage = { type: 'image', mimeType: 'image/png', data: png };
const service = () => new CodexGatewayService({ token: 'synthetic-gateway-token' });
function post(gateway: CodexGatewayService, input: unknown[], tools: unknown[] = []) {
	return gateway.fetch(
		new globalThis.Request('http://localhost/v1/responses', {
			method: 'POST',
			headers: { Authorization: 'Bearer synthetic-gateway-token', 'thread-id': 'images' },
			body: JSON.stringify({ model: 'claude-opus-5-5', stream: true, input, tools })
		})
	);
}
beforeEach(() => {
	seen.prompts = [];
	seen.results = [];
	seen.calls = 0;
});

test('attachment pixels reach the SDK input stream with text and highlight context', async () => {
	const response = await post(service(), [
		{
			role: 'user',
			content: [
				{ type: 'input_text', text: 'Inspect the highlighted button', selection: { x: 5, y: 7 } },
				image
			]
		}
	]);
	expect(await response.text()).toContain('image processed');
	expect(seen.prompts[0]).toMatchObject({
		type: 'user',
		message: { content: expect.arrayContaining([imageBlock]) }
	});
	const text = JSON.stringify(seen.prompts[0]);
	expect(text).toContain('Inspect the highlighted button');
	expect(text).toContain('selection');
	expect(text.split(png)).toHaveLength(2);
});

test.each(['function_call_output', 'custom_tool_call_output'])(
	'browser screenshot %s remains an image on the correlated tool reply',
	async (type) => {
		const gateway = service();
		const start = await post(
			gateway,
			[{ role: 'user', content: 'Use the screenshot tool' }],
			[{ type: 'function', name: 'screenshot', parameters: { type: 'object', properties: {} } }]
		);
		const batch = await start.text();
		const call = batch
			.split('\n')
			.filter((line) => line.startsWith('data: '))
			.map((line) => JSON.parse(line.slice(6)))
			.find((item) => item.item?.call_id)?.item.call_id;
		expect(call).toBeTruthy();
		const result = await post(gateway, [
			{
				type,
				call_id: call,
				output: JSON.stringify({
					content: [{ type: 'text', text: 'Selected checkout button' }, toolImage],
					highlight: { x: 5, y: 7 }
				})
			}
		]);
		expect(await result.text()).toContain('image processed');
		expect(seen.results[0]).toMatchObject({ content: expect.arrayContaining([toolImage]) });
		expect(JSON.stringify(seen.results[0])).toContain('highlight');
	}
);

test.each([
	{ type: 'input_image', image_url: 'data:image/png;base64,not-an-image' },
	{ type: 'input_image', file_id: 'private-provider-file' },
	{ type: 'input_image', image_url: 'file:///private/unreadable.png' },
	{ type: 'input_audio', data: 'synthetic-audio' },
	{ type: 'input_file', file_id: 'private-provider-file' }
])('unsupported media fails before inference instead of becoming text: %j', async (block) => {
	const response = await post(service(), [{ role: 'user', content: [block] }]);
	expect(response.status).toBe(400);
	expect(await response.text()).toContain('unsupported_content');
	expect(seen.calls).toBe(0);
});

test('cancelling a response with a pending screenshot prevents a late tool delivery', async () => {
	const gateway = service();
	const response = await post(
		gateway,
		[{ role: 'user', content: [image] }],
		[{ type: 'function', name: 'screenshot', parameters: { type: 'object', properties: {} } }]
	);
	const reader = response.body!.getReader();
	let text = '';
	while (!text.includes('call_id')) {
		const chunk = await reader.read();
		text += new TextDecoder().decode(chunk.value);
	}
	const call = text
		.split('\n')
		.filter((line) => line.startsWith('data: '))
		.map((line) => JSON.parse(line.slice(6)))
		.find((item) => item.item?.call_id)?.item.call_id;
	await reader.cancel();
	const late = await post(gateway, [
		{ type: 'function_call_output', call_id: call, output: [image] }
	]);
	expect(late.status).toBe(400);
	expect(seen.results).toHaveLength(0);
	expect(seen.calls).toBe(1);
});
