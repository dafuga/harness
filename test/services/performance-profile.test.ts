import { profileProfiler } from '../support/taskProfiles';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { PerformanceProfileService } from '../../src/services/PerformanceProfileService';
import { benchmarkCaptureSchema } from '../../src/core/verifyTypes';

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
		for (const workload of ['short-title', 'long-title'])
			await profiler.capture(
				{ unit: 'function.title', callable: 'formatTitle', workload, rounds: 1, iterations: 2 },
				() => workload.toLowerCase()
			);
		const lines = (await readFile(join(directory, 'captures.ndjson'), 'utf8'))
			.trim()
			.split('\n')
			.map((line) => JSON.parse(line));
		expect(new Set(lines.map((line) => line.file)).size).toBe(2);
		const captured = await Promise.all(
			lines.map(async (line) =>
				benchmarkCaptureSchema.parse(JSON.parse(await readFile(join(directory, line.file), 'utf8')))
			)
		);
		expect(captured.map((capture) => capture.measurements[0].workload)).toEqual([
			'short-title',
			'long-title'
		]);
		expect(lines.every((line) => line.kind === 'benchmark')).toBe(true);
	} finally {
		vi.unstubAllEnvs();
		await rm(directory, { recursive: true, force: true });
	}
});
