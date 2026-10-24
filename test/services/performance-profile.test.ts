import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { benchmarkCaptureSchema } from '../../src/core/verification-evidence/verifyTypes';
import { PerformanceProfileService } from '../../src/services/verification-evidence/PerformanceProfileService';
import {
	isolatedProfileCapture,
	profileProfiler,
	profileSingleCallObservation
} from '../support/taskProfiles';

test('profiles the representative operation and labels process memory honestly', async () => {
	const operation = vi.fn(() => ' A title '.trim().toLowerCase());
	const measurements = await new PerformanceProfileService().measure(
		{
			unit: 'function.title',
			workload: 'title-text',
			callable: 'formatTitle',
			rounds: 3,
			iterations: 20,
			warmups: 2
		},
		operation
	);
	expect(operation).toHaveBeenCalledTimes(62);
	expect(operation.mock.results.every((result) => result.value === 'a title')).toBe(true);
	expect(benchmarkCaptureSchema.safeParse({ measurements }).success).toBe(true);
	expect(measurements.map((item) => item.metric)).toEqual([
		'latency-warm-ms',
		'process-peak-rss-bytes'
	]);
	expect(measurements.every((item) => item.samples === 60 && item.callable === 'formatTitle')).toBe(
		true
	);
	expect(measurements[0].value).toBeGreaterThanOrEqual(0);
	expect(measurements[1].value).toBeGreaterThan(0);
	expect(measurements[1].method).toContain('not memory attributable');
	await profileProfiler();
});

test('failed workloads and invalid sampling cannot produce successful observations', async () => {
	const profiler = new PerformanceProfileService();
	await expect(
		profiler.measure({ unit: 'function.fail', workload: 'fails', iterations: 1 }, async () => {
			throw new Error('operation failed');
		})
	).rejects.toThrow('operation failed');
	const operation = vi.fn();
	await expect(
		profiler.measure({ unit: 'function.fail', workload: 'fails', rounds: 0 }, operation)
	).rejects.toThrow();
	expect(operation).not.toHaveBeenCalled();
});

test('Harness capture retains separate workloads in its standard benchmark evidence protocol', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'harness-profile-captures-'));
	vi.stubEnv('HARNESS_EVIDENCE_DIR', directory);
	vi.stubEnv('TAKE_SCREENSHOT', '1');
	try {
		const profiler = new PerformanceProfileService();
		for (const workload of ['short-title', 'long-title', 'short-title'])
			await profiler.capture(
				{ unit: 'function.title', callable: 'formatTitle', workload, rounds: 1, iterations: 2 },
				() => workload.toLowerCase()
			);
		const lines = (await readFile(join(directory, 'captures.ndjson'), 'utf8'))
			.trim()
			.split('\n')
			.map((line) => JSON.parse(line));
		expect(new Set(lines.map((line) => line.file)).size).toBe(3);
		const captured = await Promise.all(
			lines.map(async (line) =>
				benchmarkCaptureSchema.parse(JSON.parse(await readFile(join(directory, line.file), 'utf8')))
			)
		);
		expect(captured.map((capture) => capture.measurements[0].workload)).toEqual([
			'short-title',
			'long-title',
			'short-title'
		]);
		expect(lines.every((line) => line.kind === 'benchmark')).toBe(true);
	} finally {
		vi.unstubAllEnvs();
		await rm(directory, { recursive: true, force: true });
	}
});

test('single-pass observations retain synchronous results and never repeat effects', async () => {
	await isolatedProfileCapture(async (directory) => {
		const profiler = new PerformanceProfileService();
		const result = { title: 'One title' };
		const operation = vi.fn(() => result);
		const input = { unit: 'function.title', callable: 'title', workload: 'title-once' };
		expect(profiler.observe(input, operation)).toBe(result);
		expect(profiler.observe(input, operation)).toBe(result);
		expect(operation).toHaveBeenCalledTimes(2);
		const measurements = profiler.flush();
		expect(measurements).toHaveLength(2);
		expect(measurements.every((item) => item.samples === 2 && item.workload === 'title-once')).toBe(
			true
		);
		expect(measurements.find((item) => item.unitOfMeasure === 'ms')!.value).toBeGreaterThanOrEqual(
			0
		);
		const memory = measurements.find((item) => item.unitOfMeasure === 'bytes')!;
		expect(memory.value).toBeGreaterThan(0);
		expect(memory.method).toContain('whole process');
		expect(profiler.flush()).toEqual([]);
		const lines = (await readFile(join(directory, 'captures.ndjson'), 'utf8')).trim().split('\n');
		expect(lines).toHaveLength(1);
		const captured = JSON.parse(await readFile(join(directory, JSON.parse(lines[0]).file), 'utf8'));
		expect(benchmarkCaptureSchema.parse(captured).measurements).toEqual(measurements);
	});
	await profileSingleCallObservation();
});

test('awaited observations finish only after the actual operation settles', async () => {
	await isolatedProfileCapture(async () => {
		const profiler = new PerformanceProfileService();
		const result = { title: 'Ready' };
		let finish!: (value: typeof result) => void;
		const pending = new Promise<typeof result>((resolve) => (finish = resolve));
		const input = { unit: 'function.title', workload: 'pending-title' };
		expect(profiler.observe(input, () => pending)).toBe(pending);
		expect(profiler.flush()).toEqual([]);
		const operation = vi.fn(() => pending);
		const observed = profiler.observeAsync(input, operation);
		expect(profiler.flush()).toEqual([]);
		finish(result);
		expect(await observed).toBe(result);
		expect(operation).toHaveBeenCalledTimes(1);
		const measurements = profiler.flush();
		expect(measurements).toHaveLength(2);
		expect(measurements.every((item) => item.samples === 1)).toBe(true);
		expect(measurements.find((item) => item.unitOfMeasure === 'ms')!.method).toContain('await');
	});
});

test('observation failures and invalid subjects produce no successful samples', async () => {
	await isolatedProfileCapture(async () => {
		const profiler = new PerformanceProfileService();
		const input = { unit: 'function.title', workload: 'title-failure' };
		const failure = new Error('the original operation failed');
		expect(() =>
			profiler.observe(input, () => {
				throw failure;
			})
		).toThrow(failure);
		await expect(
			profiler.observeAsync(input, async () => {
				throw failure;
			})
		).rejects.toBe(failure);
		const operation = vi.fn();
		expect(() => profiler.observe({ ...input, unit: '' }, operation)).toThrow();
		await expect(profiler.observeAsync({ ...input, workload: '' }, operation)).rejects.toThrow();
		expect(operation).not.toHaveBeenCalled();
		expect(profiler.flush()).toEqual([]);
	});
});

test('one-pass captures retain separate callable and workload observations', async () => {
	await isolatedProfileCapture(async (directory) => {
		const profiler = new PerformanceProfileService();
		for (const [callable, workload] of [
			['title', 'short'],
			['title', 'long'],
			['subtitle', 'short']
		])
			profiler.observe({ unit: 'function.title', callable, workload }, () =>
				workload.toUpperCase()
			);
		const measurements = profiler.flush();
		expect(measurements).toHaveLength(6);
		expect(new Set(measurements.map((item) => `${item.callable}/${item.workload}`)).size).toBe(3);
		const lines = (await readFile(join(directory, 'captures.ndjson'), 'utf8')).trim().split('\n');
		expect(new Set(lines.map((line) => JSON.parse(line).file)).size).toBe(3);
	});
});

test('observation chunks never overwrite another producer or an earlier flush', async () => {
	await isolatedProfileCapture(async (directory) => {
		const first = new PerformanceProfileService();
		const second = new PerformanceProfileService();
		const input = { unit: 'function.title', workload: 'same-title' };
		for (const profiler of [first, second, first]) {
			profiler.observe(input, () => ' A title '.trim());
			profiler.flush();
		}
		const lines = (await readFile(join(directory, 'captures.ndjson'), 'utf8')).trim().split('\n');
		const files = lines.map((line) => JSON.parse(line).file);
		expect(files).toHaveLength(3);
		expect(new Set(files).size).toBe(3);
		for (const file of files) {
			const capture = benchmarkCaptureSchema.parse(
				JSON.parse(await readFile(join(directory, file), 'utf8'))
			);
			expect(capture.measurements.every((item) => item.samples === 1)).toBe(true);
		}
	});
});
