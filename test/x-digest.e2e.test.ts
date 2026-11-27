import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
import { ViewerDeviceRepository } from '../src/repositories/execution-runtimes/ViewerDeviceRepository';
import { senderConfig } from './support/xDigestConfig';
import { withTempDir } from './support/temporary';

const cli = resolve(import.meta.dirname, '../src/cli/index.ts');
const run = (...args: string[]) =>
	promisify(execFile)('bun', [cli, ...args], { timeout: 30_000 }).then(
		({ stdout }) => ({ code: 0, output: stdout }),
		(error: { code: number; stderr: string; stdout: string }) => ({
			code: error.code,
			output: error.stdout + error.stderr
		})
	);

test('x-digest refuses a config that would post to a channel', async () => {
	await withTempDir('x-digest-e2e-', async (directory) => {
		const config = senderConfig();
		config.slack.channel = 'C0CHANNEL';
		const file = join(directory, 'config.json');
		await writeFile(file, JSON.stringify(config));
		const result = await run('x-digest', 'send', '--config', file);
		expect(result.code).not.toBe(0);
		expect(result.output).toContain('Invalid X digest sender config: slack.channel');
	});
});

test('container-browser approves only the code a waiting device shows', async () => {
	await withTempDir('x-viewer-e2e-', async (directory) => {
		const devices = new ViewerDeviceRepository(directory);
		const { token, code } = devices.request();
		const options = ['--profile', 'x', '--directory', directory];
		const wrong = code === '111111' ? '222222' : '111111';
		const refused = await run('container-browser', 'approve', wrong, ...options);
		expect(refused.output).toContain('No waiting device shows that code');
		expect(devices.access(token).status).toBe('pending');
		expect((await run('container-browser', 'approve', code, ...options)).code).toBe(0);
		expect(devices.access(token).status).toBe('approved');
		await run('container-browser', 'revoke', ...options);
		expect(devices.access(token).status).toBe('unknown');
	});
});
