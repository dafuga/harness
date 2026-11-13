import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, test } from 'vitest';
import { benchmarkProcess } from '../src/cli/program/benchmark-service/benchmarkProcess';
import { peakMemory } from '../src/cli/program/run-kernel-bench/kernel-benchmark-service/peakMemory';
import { serveKernel } from '../src/cli/program/run-kernel-bench/kernel-benchmark-service/KernelBenchmarkService';

test('deadline stops the spawned process instead of leaving background work', async () => {
	const root = await mkdtemp(join(tmpdir(), 'benchmark-cancel-'));
	try {
		const signal = AbortSignal.timeout(200);
		await expect(
			benchmarkProcess({
				cwd: root,
				signal,
				command: [
					'bun',
					'-e',
					"setInterval(() => require('fs').writeFileSync('heartbeat', String(Date.now())), 10)"
				]
			})
		).rejects.toThrow();
		await expect(
			benchmarkProcess({
				cwd: root,
				timeoutMs: 50,
				signal: AbortSignal.timeout(250),
				command: ['bun', '-e', 'setInterval(()=>{},100)']
			})
		).rejects.toThrow(/timed out/);
		const startup = serveKernel(['bun', '-e', 'setTimeout(()=>process.exit(0),250)'], 50).then(
			() => false,
			(error: Error) => error.message.includes('timed out')
		);
		expect(
			await Promise.race([startup, new Promise((resolve) => setTimeout(() => resolve(false), 400))])
		).toBe(true);
		await assertNestedTimeout(root);
		const before = await readFile(join(root, 'heartbeat'), 'utf8');
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(await readFile(join(root, 'heartbeat'), 'utf8')).toBe(before);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

async function assertNestedTimeout(root: string): Promise<void> {
	const pidFile = join(root, 'nested-pid');
	const script = join(root, 'nested.mjs');
	const childCode = 'setTimeout(()=>process.exit(0),700); setInterval(()=>{},20)';
	await writeFile(
		script,
		`import {spawn} from 'node:child_process'; import {writeFileSync} from 'node:fs'; const child=spawn(process.execPath,['-e',${JSON.stringify(childCode)}],{stdio:'ignore'}); writeFileSync(${JSON.stringify(pidFile)},String(child.pid)); setTimeout(()=>process.exit(0),600);`
	);
	try {
		await expect(
			Promise.resolve().then(() => peakMemory('bun', [script], '', 100))
		).rejects.toThrow(/timed out/);
		const pid = Number(await readFile(pidFile, 'utf8'));
		const alive = () => {
			try {
				process.kill(pid, 0);
				return true;
			} catch {
				return false;
			}
		};
		await expect.poll(alive, { timeout: 400 }).toBe(false);
	} finally {
		// Even an unfixed implementation cannot leave this synthetic process behind.
		await new Promise((resolve) => setTimeout(resolve, 750));
	}
}
