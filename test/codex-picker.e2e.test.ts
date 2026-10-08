import { expect, test } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtemp, mkdir, writeFile, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('MCP CLI persists session queues across processes without changing native config', async () => {
	const { root, config, panel, model } = await createFixture();
	const entry = process.env.HARNESS_PICKER_CLI_ENTRY ?? resolve('src/index.ts');
	const connect = async () => {
		const client = new Client({ name: 'fixture', version: '1' });
		await client.connect(
			new StdioClientTransport({
				command: 'bun',
				args: [entry, 'codex', 'picker-mcp', '--panel-file', panel],
				env: {
					PATH: process.env.PATH ?? '',
					HOME: root,
					CODEX_HOME: root,
					HARNESS_PICKER_HOME: join(root, 'queue')
				},
				stderr: 'pipe'
			})
		);
		return client;
	};
	let client: Client | null = await connect();
	try {
		const first = await client.callTool({
			name: 'request_model_switch',
			arguments: {
				session_id: 'session-a',
				provider: 'harness-claude',
				model: model.slug,
				effort: 'xhigh'
			}
		});
		expect(first.structuredContent).toMatchObject({
			request: { status: 'pending' },
			active: null,
			defaultProvider: 'openai'
		});
		await client.close();
		client = await connect();
		const restored = await client.callTool({
			name: 'get_provider_status',
			arguments: { session_id: 'session-a' }
		});
		expect(restored.structuredContent).toEqual(first.structuredContent);
		const separate = await client.callTool({
			name: 'get_provider_status',
			arguments: { session_id: 'session-b' }
		});
		expect(separate.structuredContent).toMatchObject({ request: null });
		expect(await readFile(config, 'utf8')).toBe('model="native-fixture"\n');
		expect((await stat(join(root, 'queue/provider-switches.sqlite'))).mode & 0o777).toBe(0o600);
	} finally {
		await client?.close();
		await rm(root, { recursive: true, force: true });
	}
}, 20_000);

async function createFixture() {
	const root = await mkdtemp(join(tmpdir(), 'harness-picker-'));
	const config = join(root, 'config.toml');
	const panel = join(root, 'panel.html');
	const model = {
		slug: 'claude-opus-5-5',
		display_name: 'Claude Opus 5.5',
		default_reasoning_level: 'xhigh',
		supported_reasoning_levels: [{ effort: 'xhigh' }]
	};
	await mkdir(join(root, 'harness-gateway'));
	await writeFile(
		join(root, 'harness-gateway', 'claude-models.json'),
		JSON.stringify({ models: [model] })
	);
	await writeFile(config, 'model="native-fixture"\n');
	await writeFile(panel, '<html>Panel fixture</html>');
	return { root, config, panel, model };
}
