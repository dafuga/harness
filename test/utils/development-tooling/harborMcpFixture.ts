import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { expect } from 'vitest';
import { measureWorkload } from '../../support/measureWorkload';
import { ownEnvironment } from '../../support/cli';
import { withTempDir } from '../../support/temporary';

const cli = resolve('src/cli/index.ts');
const fixture = `
const { createInterface } = require('node:readline');
const input = createInterface({ input: process.stdin });
const signals = ['SIGINT', 'SIGTERM'];
if (!process.argv[3].endsWith('stubborn')) {
  for (const signal of signals) process.on(signal, () => {
    setTimeout(() => {
      process.stderr.write('fixture cleanup complete\\n');
      input.close();
      process.stdin.destroy();
    }, 40);
  });
} else {
  for (const signal of signals) process.on(signal, () => {});
}
input.on('line', (line) => {
  const scoped = !process.env.OPENAI_API_KEY && !process.env.HARBOR_PRIVATE_KEY &&
    !process.env.NODE_OPTIONS && !process.env.HARBOR_API_URL;
  process.stdout.write(JSON.stringify({ line, scoped, args: process.argv.slice(2),
    cli: process.env.HARNESS_CLI_PATH, pid: process.pid }) + '\\n');
});
`;

export async function checkHarborMcp(state: string): Promise<void> {
	return withTempDir('harness-harbor-mcp-', async (root) => {
		const workspace = join(root, 'workspace ; ' + state);
		const entry = join(root, 'SDK fixture.cjs');
		await mkdir(workspace);
		await writeFile(entry, fixture);
		await measureWorkload('command.projects-sessions-harbor-inspection', 'mcp-' + state, () =>
			checkProcess(entry, workspace, state)
		);
	});
}

async function checkProcess(entry: string, workspace: string, state: string): Promise<void> {
	const child = spawn('bun', [cli, 'harbor', 'mcp', workspace], {
		env: {
			...ownEnvironment(),
			HARNESS_ANALYTICS_DISABLED: '1',
			HARNESS_CLI_PATH: '/fixture/not-used.js',
			HARNESS_HARBOR_APP_SDK_PATH: entry,
			HARNESS_HARBOR_NODE_PATH: process.execPath,
			OPENAI_API_KEY: 'synthetic-provider',
			HARBOR_PRIVATE_KEY: 'synthetic-signer',
			HARBOR_API_URL: 'https://not-used.invalid',
			NODE_OPTIONS: '--require /fixture/not-imported.cjs'
		},
		stdio: 'pipe'
	});
	const closed = once(child, 'close');
	const lines = createInterface({ input: child.stdout });
	const replies = lines[Symbol.asyncIterator]();
	let stderr = '';
	let sdkPid: number | undefined;
	child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
	child.stdin.on('error', () => {});
	const timeout = setTimeout(() => {
		child.kill('SIGKILL');
		if (sdkPid !== undefined) killFixture(sdkPid);
	}, 4000);
	try {
		await checkReplies(
			child.stdin,
			replies,
			workspace,
			() => stderr,
			(pid) => (sdkPid = pid)
		);
		if (state === 'eof') child.stdin.end();
		else child.kill(state === 'interrupt' ? 'SIGINT' : 'SIGTERM');
		const status = state === 'eof' ? 0 : state === 'interrupt' ? 130 : 143;
		await expect(closed).resolves.toStrictEqual([status, null]);
		expect(stderr).toBe(state === 'interrupt' ? 'fixture cleanup complete\n' : '');
		expect(() => process.kill(sdkPid!, 0)).toThrow();
	} finally {
		clearTimeout(timeout);
		lines.close();
		child.stdin.destroy();
		child.kill('SIGKILL');
		if (sdkPid !== undefined) killFixture(sdkPid);
		await closed;
	}
}

async function checkReplies(
	input: NodeJS.WritableStream,
	replies: AsyncIterableIterator<string>,
	workspace: string,
	errorOutput: () => string,
	observePid: (pid: number) => void
) {
	let pid: number | undefined;
	for (const line of ['{"id":1}', '{"id":2,"text":"Harbor 港"}']) {
		input.write(line + '\n');
		const reply = await replies.next();
		expect(reply.done, errorOutput() || 'expected reply before stdin EOF').toBe(false);
		const payload = JSON.parse(reply.value);
		expect(payload).toStrictEqual({
			line,
			scoped: true,
			args: ['mcp', workspace],
			cli,
			pid: expect.any(Number)
		});
		pid ??= payload.pid;
		if (pid !== undefined) observePid(pid);
		expect(payload.pid).toBe(pid);
	}
}

function killFixture(pid: number): void {
	try {
		process.kill(pid, 'SIGKILL');
	} catch {
		// The test checks that the SDK has already shut down.
	}
}
