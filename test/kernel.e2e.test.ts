import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import type { Measurement } from '../src/core/verificationTypes';
import { recordCapture } from '../src/utils/record-capture/recordCapture';
import { runHarness } from './support/cli';

interface Bench {
	contract: string;
	profile: {
		id: string;
		platform: string;
		arch: string;
		cpu: string;
		cores: number;
		runtime: string;
	};
	source: { commit: string | null; dirty: boolean };
	workloads: Array<{ id: string; nodes: number; edges: number; requestBytes: number }>;
	measurements: Measurement[];
	default: { runtime: string; basis: string; workload: string; rule: string };
}

/**
 * Under verification, what this run measured for each built kernel is its benchmark evidence.
 * A quick run is not a controlled comparison, so the numbers carry no comparison context and
 * no budget is judged by them; sizes and hashes of the built files are exact.
 */
function recordBenchmarks(bench: Bench): void {
	for (const [state, target] of [
		['native', 'process'],
		['wasm', 'wasm']
	]) {
		const measurements = bench.measurements
			.filter((item) => item.target === target)
			.map(({ unit, metric, unitOfMeasure, value, unavailable, method, workload, samples }) => ({
				unit,
				metric,
				unitOfMeasure,
				value,
				...(unavailable ? { unavailable } : {}),
				method,
				workload,
				target,
				...(samples ? { samples } : {})
			}));
		recordCapture(
			{
				evidence: 'benchmark',
				kind: 'benchmark',
				state,
				file: `benchmark-${state}.json`,
				mediaType: 'application/json',
				note: 'kernel bench --quick on this machine; not a controlled comparison.'
			},
			JSON.stringify({ profile: bench.profile.id, target, measurements }, null, 2)
		);
	}
}

const find = (bench: Bench, target: string, metric: string) =>
	bench.measurements.filter((item) => item.target === target && item.metric === metric);

test('kernel parity compares the reference with the built Wasm and native runtimes', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-kernel-'));
	const parity = JSON.parse((await runHarness(['kernel', 'parity', '--json'], root)).stdout);
	expect(parity.status).toBe('passed');
	expect(parity.contract).toBe('impact-kernel/1');
	expect(parity.cases).toBeGreaterThanOrEqual(100);
	expect(parity.runtimes).toEqual([
		{ runtime: 'wasm', available: true, mismatches: 0 },
		{ runtime: 'process', available: true, mismatches: 0 }
	]);
	const missing = await runHarness(['kernel', 'parity', '--json'], root, false, {
		HARNESS_KERNEL_DIR: root
	});
	expect(missing.exitCode).toBe(1);
	expect(JSON.parse(missing.stdout).status).toBe('incomplete');
	expect(missing.stderr).toContain('wasm runtime is not built');
	await rm(root, { recursive: true, force: true });
}, 120_000);

test('kernel bench measures identical workloads fairly and records unavailable values honestly', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-bench-'));
	const output = join(root, 'bench.json');
	await runHarness(['kernel', 'bench', '--quick', '--write', output], root);
	const bench = JSON.parse(await readFile(output, 'utf8')) as Bench;

	expect(bench.contract).toBe('impact-kernel/1');
	expect(bench.profile.cores).toBeGreaterThan(0);
	expect(bench.workloads.length).toBeGreaterThanOrEqual(2);
	for (const workload of bench.workloads) expect(workload.requestBytes).toBeGreaterThan(0);
	for (const target of ['module', 'wasm', 'process', 'http']) {
		for (const metric of ['latency-cold-ms', 'latency-warm-ms', 'throughput-ops']) {
			const measured = find(bench, target, metric);
			expect(measured.length, `${target} ${metric}`).toBe(bench.workloads.length);
			for (const item of measured) {
				expect(item.value, `${target} ${metric}`).toBeGreaterThan(0);
				expect(item.profile).toBe(bench.profile.id);
				expect(item.method).toMatch(/serializ/i);
				expect(item.samples).toBeGreaterThan(0);
			}
		}
	}
	const memory = (target: string) => find(bench, target, 'memory-bytes')[0];
	expect(memory('wasm').value).toBeGreaterThan(0);
	expect(memory('module')).toMatchObject({ value: null });
	expect(memory('module').unavailable).toMatch(/cannot be attributed/);
	expect(find(bench, 'wasm', 'artifact-bytes')[0].artifacts[0].sha256).toMatch(/^[0-9a-f]{64}$/);
	expect(find(bench, 'process', 'artifact-bytes')[0].value).toBeGreaterThan(1000);
	expect(find(bench, 'module', 'source-bytes')[0].value).toBeGreaterThan(1000);
	expect(find(bench, 'wasm', 'source-bytes')[0].value).toBeGreaterThan(1000);

	const cold = ['module', 'wasm', 'process'].map((target) => ({
		target,
		value: find(bench, target, 'latency-cold-ms').find(
			(item) => item.workload === bench.default.workload
		)?.value as number
	}));
	const fastest = Math.min(...cold.map((item) => item.value));
	const eligible = cold.filter((item) => item.value <= fastest * 1.05).map((item) => item.target);
	expect(bench.default.basis).toBe('measured');
	expect(bench.default.runtime).toBe(eligible[0]);
	expect(bench.default.rule).toMatch(/cold/);

	recordBenchmarks(bench);
	const chosen = JSON.parse(
		(await runHarness(['kernel', 'default', '--json', '--measurements', output], root)).stdout
	);
	expect(chosen.runtime).toBe(bench.default.runtime);
	await rm(root, { recursive: true, force: true });
}, 240_000);

test('kernel serve exposes a runtime over loopback HTTP', async () => {
	const child = spawn(
		'bun',
		[join(process.cwd(), 'src/index.ts'), 'kernel', 'serve', '--port', '0'],
		{
			stdio: ['ignore', 'pipe', 'inherit']
		}
	);
	try {
		const line = await new Promise<string>((resolve) =>
			child.stdout.once('data', (chunk: Buffer) => resolve(chunk.toString('utf8')))
		);
		const { url } = JSON.parse(line) as { url: string };
		expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
		const response = await fetch(url, { method: 'POST', body: '{"operation":"version"}' });
		expect(await response.json()).toEqual({ ok: true, output: { contract: 'impact-kernel/1' } });
		expect((await fetch(url)).status).toBe(405);
	} finally {
		child.kill();
	}
}, 60_000);
