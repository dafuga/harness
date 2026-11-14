import { expect, test, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import {
	BoundedCommandAdapter,
	commandEnvironment
} from '../../../src/adapters/execution-runtimes/BoundedCommandAdapter';
import { measureWorkload } from '../../support/measureWorkload';
import { withTempDir } from '../../support/temporary';
// Initial public method matrix: async/sync normal, failed, invalid and bounded commands.
test('async commands preserve input, binary bytes and nonzero exit results', async () => {
	const adapter = new BoundedCommandAdapter();
	expect(await adapter.checked('bun', ['-e', "process.stdout.write('ready')"])).toEqual(
		Buffer.from('ready')
	);
	await expect(adapter.checked('bun', ['-e', 'process.exit(2)'])).rejects.toThrow('exit code 2');
	const result = await measureWorkload(
		'adapter.execution-runtimes-bounded-command',
		'binary-command',
		() =>
			adapter.run('bun', ['-e', 'process.stdin.pipe(process.stdout); process.exitCode = 2'], {
				input: Buffer.from([0, 255, 13])
			})
	);
	expect(result).toEqual({ code: 2, stdout: Buffer.from([0, 255, 13]), stderr: '' });
});
test('sync commands preserve exit information and enforce their limits', () => {
	const adapter = new BoundedCommandAdapter();
	expect(adapter.runSync('git', ['--version']).code).toBe(0);
	expect(
		adapter.runSync('git', ['rev-parse', '--verify', 'harness-invalid-probe-reference']).code
	).not.toBe(0);
	expect(() => adapter.runSync('git', ['--version'], { maxBuffer: 1 })).toThrow();
	expect(() => adapter.runSync('git', ['--version'], { timeoutMs: 0 })).toThrow(/positive finite/);
	expect(() => adapter.runSync('bun', ['-e', 'process.exit(0)'])).toThrow(/direct probes/);
	expect(() => adapter.runSync('git', ['fetch'])).toThrow(/direct probes/);
});
test('async commands stop on deadline, output overflow, cancellation or failed launch', async () => {
	const adapter = new BoundedCommandAdapter();
	await expect(
		adapter.run('bun', ['-e', 'setInterval(()=>{},100)'], { timeoutMs: 50 })
	).rejects.toThrow(/timed out/);
	await expect(
		adapter.run('bun', ['-e', "process.stderr.write('abcd')"], { maxBuffer: 2 })
	).rejects.toThrow(/output limit/);
	await expect(
		adapter.run('bun', ['-e', 'setInterval(()=>{},100)'], { signal: AbortSignal.timeout(50) })
	).rejects.toThrow();
	await expect(adapter.run('harness-nonexistent-fixture-command')).rejects.toThrow();
	expect(() => adapter.run('bun', [], { timeoutMs: Infinity })).toThrow(/positive finite/);
});
test('timeout kills a nested child as well as its command wrapper', async () => {
	await withTempDir('bounded-nested-', async (dir) => {
		const pidPath = join(dir, 'child.pid');
		const nested = `import {spawn} from 'node:child_process'; import {writeFileSync} from 'node:fs'; const c=spawn(process.execPath,['-e','setInterval(()=>{},100)'],{stdio:'ignore'}); writeFileSync(${JSON.stringify(pidPath)},String(c.pid)); setInterval(()=>{},100);`;
		await expect(
			new BoundedCommandAdapter().run('bun', ['-e', nested], { timeoutMs: 150 })
		).rejects.toThrow(/timed out/);
		const pid = Number(await readFile(pidPath, 'utf8'));
		await expect.poll(() => isAlive(pid), { timeout: 500 }).toBe(false);
	});
});
test.each(['SIGINT', 'SIGTERM'] as const)(
	'parent %s stops detached command process groups',
	async (signal) => {
		await withTempDir('bounded-signal-', async (dir) => {
			const pidPath = join(dir, 'child.pid');
			const modulePath = new URL(
				'../../../src/adapters/execution-runtimes/BoundedCommandAdapter.ts',
				import.meta.url
			).pathname;
			const nested = `import {spawn} from 'node:child_process'; import {writeFileSync} from 'node:fs'; const c=spawn(process.execPath,['-e','setInterval(()=>{},100)'],{stdio:'ignore'}); writeFileSync(${JSON.stringify(pidPath)},String(c.pid)); setInterval(()=>{},100);`;
			const parent = spawn(
				'bun',
				[
					'-e',
					`import {BoundedCommandAdapter} from ${JSON.stringify(modulePath)}; new BoundedCommandAdapter().run('bun',['-e',${JSON.stringify(nested)}]).catch(()=>{});`
				],
				{ stdio: 'ignore' }
			);
			try {
				await expect.poll(() => fileExists(pidPath), { timeout: 3000 }).toBe(true);
				const childPid = Number(await readFile(pidPath, 'utf8'));
				parent.kill(signal);
				await expect.poll(() => isAlive(childPid), { timeout: 800 }).toBe(false);
			} finally {
				if (parent.exitCode === null && parent.signalCode === null) parent.kill('SIGKILL');
			}
		});
	}
);
test('real children receive required synthetic config but not unrelated credentials', async () => {
	vi.stubEnv('HARNESS_BOUNDED_SECRET_FIXTURE', 'synthetic');
	vi.stubEnv('SSH_AUTH_SOCK', '/fixture/ssh-agent.sock');
	vi.stubEnv('HTTPS_PROXY', 'http://fixture.invalid:8000');
	vi.stubEnv('NODE_OPTIONS', '--no-warnings');
	vi.stubEnv('GH_TOKEN', 'synthetic-github-token');
	try {
		expect(Object.hasOwn(commandEnvironment(), 'HARNESS_BOUNDED_SECRET_FIXTURE')).toBe(false);
		expect(Object.hasOwn(commandEnvironment(), 'SSH_AUTH_SOCK')).toBe(false);
		const result = await new BoundedCommandAdapter().run(
			'bun',
			[
				'-e',
				'process.stdout.write(JSON.stringify({proxy:process.env.HTTPS_PROXY,node:process.env.NODE_OPTIONS,token:process.env.GH_TOKEN,secret:process.env.HARNESS_BOUNDED_SECRET_FIXTURE}))'
			],
			{ env: commandEnvironment() }
		);
		expect(JSON.parse(result.stdout.toString())).toEqual({
			proxy: 'http://fixture.invalid:8000',
			node: '--no-warnings',
			token: 'synthetic-github-token'
		});
	} finally {
		vi.unstubAllEnvs();
	}
});

async function fileExists(path: string): Promise<boolean> {
	try {
		await readFile(path);
		return true;
	} catch {
		return false;
	}
}
function isAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}
