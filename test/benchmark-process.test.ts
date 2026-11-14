import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, test } from 'vitest';
import { benchmarkProcess } from '../src/cli/program/benchmark-service/benchmarkProcess';
import { peakMemory } from '../src/cli/program/run-kernel-bench/kernel-benchmark-service/peakMemory';
import { measureWorkload } from './support/measureWorkload';
import { serveKernel } from '../src/cli/program/run-kernel-bench/kernel-benchmark-service/KernelBenchmarkService';
import { KernelBenchmarkService } from '../src/cli/program/run-kernel-bench/kernel-benchmark-service/KernelBenchmarkService';

test('deadline stops the spawned process instead of leaving background work', async () => {
	const root = await mkdtemp(join(tmpdir(), 'benchmark-cancel-'));
	try {
		await assertSuccessfulProcesses(root);
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

test('kernel cold samples run asynchronously instead of using the probe-only sync runner', async () => {
	const service = new KernelBenchmarkService(
		{
			cli: ['bun', '-e', 'process.stdout.write(JSON.stringify({elapsedMs:7}))'],
			coldSamples: 1,
			warmIterations: 1
		},
		{} as never
	);
	const sample = (
		service as unknown as {
			sample(target: string, run: { nodes: number; seed: number }, url: string): Promise<number>;
		}
	).sample;
	await expect(
		measureWorkload('service.kernel-benchmark', 'cold-module-sample', () =>
			sample.call(service, 'module', { nodes: 1, seed: 1 }, '')
		)
	).resolves.toBe(7);
});

async function assertSuccessfulProcesses(root: string): Promise<void> {
	const normal = await benchmarkProcess({
		cwd: root,
		command: ['bun', '-e', "process.stdout.write('ready')"],
		timeoutMs: 3000
	});
	expect(normal).toMatchObject({ exitCode: 0, stdout: 'ready', stderr: '' });
	const peak = await peakMemory('bun', ['-e', 'process.exit(0)'], '', 3000);
	if ('bytes' in peak) expect(peak.bytes).toBeGreaterThan(0);
	else expect(peak.unavailable).toBeTruthy();
	const ready = await measureWorkload('service.kernel-benchmark', 'kernel-readiness-protocol', () =>
		serveKernel(
			[
				'bun',
				'-e',
				"console.log(JSON.stringify({url:'http://127.0.0.1:49152'}));setInterval(()=>{},100)"
			],
			3000
		)
	);
	try {
		expect(ready.url).toBe('http://127.0.0.1:49152');
	} finally {
		ready.stop();
	}
}

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
