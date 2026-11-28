import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
import { withTempDir } from './support/temporary';

test('harness assistant check validates BuildFlexity without credentials or external requests', async () => {
	await withTempDir('assistant-cli-', async (root) => {
		const config = resolve('specification/examples/buildflexity-slack-assistant.json');
		const preload = join(root, 'offline.mjs');
		await writeFile(preload, "globalThis.fetch = () => { throw new Error('unexpected fetch'); };");
		const command = [
			'--preload',
			preload,
			resolve('src/cli/index.ts'),
			'assistant',
			'check',
			'--config'
		];
		const run = promisify(execFile);
		const result = await run('bun', [...command, config]);
		expect(result.stdout.trim()).toBe('Valid project assistant config for BuildFlexity');
		expect(result.stderr).toBe('');

		const invalid = join(root, 'invalid.json');
		const project = JSON.parse(await readFile(config, 'utf8'));
		project.canvas.channels = ['CUNAPPROVED'];
		await writeFile(invalid, JSON.stringify(project));
		await expect(run('bun', [...command, invalid])).rejects.toMatchObject({
			code: 1,
			stderr: expect.stringContaining('Assistant config is unreadable or invalid.')
		});
	});
});

test('harness assistant run refuses a different bot identity before any live actions', async () => {
	await withTempDir('assistant-cli-', async (root) => {
		const config = resolve('specification/examples/buildflexity-slack-assistant.json');
		const preload = join(root, 'identity.mjs');
		const calls = join(root, 'requests.log');
		await writeFile(join(root, 'slack-bot-token'), 'xoxb-synthetic-fixture', { mode: 0o600 });
		await writeFile(
			preload,
			`
			import { appendFileSync } from 'node:fs';
			globalThis.fetch = async (input) => {
				appendFileSync(${JSON.stringify(calls)}, new URL(String(input)).pathname + '\\n');
				return Response.json({ ok: true, team_id: 'TOTHER', bot_id: 'BOTHER', user_id: 'UOTHER' });
			};
		`
		);
		const command = [
			'--preload',
			preload,
			resolve('src/cli/index.ts'),
			'assistant',
			'run',
			'--config',
			config,
			'--credentials',
			root
		];
		await expect(promisify(execFile)('bun', command)).rejects.toMatchObject({
			code: 1,
			stderr: expect.stringContaining('identity-mismatch')
		});
		expect((await readFile(calls, 'utf8')).trim()).toBe('/api/auth.test');
	});
});
