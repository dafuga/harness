import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { benchmarkCaptureSchema } from '../../src/core/verification-evidence/verifyTypes';
import { PerformanceProfileService } from '../../src/services/verification-evidence/PerformanceProfileService';
import { runCommand } from '../support/cli';
import { measureProcess } from '../support/cli-measurement/measureProcess';
import { isolatedProfileCapture, observedTaskOperation } from '../support/taskProfiles';

const input = { unit: 'function.schema-fixture', workload: 'initialize-fields' };

test('explicit awaited scopes preserve one effect, result identity and rejection without replay', async () => {
	await isolatedProfileCapture(async (directory) => {
		let calls = 0;
		const value = { id: 'owned-result' };
		const operation = async () => {
			calls++;
			return value;
		};
		expect(await observedTaskOperation('service.fixture', 'one-owned-operation', operation)).toBe(
			value
		);
		expect(calls).toBe(1);
		const error = new Error('actual failure');
		await expect(
			observedTaskOperation('service.fixture', 'failed-operation', async () => {
				throw error;
			})
		).rejects.toBe(error);
		const captures = (await readFile(join(directory, 'captures.ndjson'), 'utf8'))
			.trim()
			.split('\n');
		expect(captures).toHaveLength(1);
		const data = benchmarkCaptureSchema.parse(
			JSON.parse(await readFile(join(directory, JSON.parse(captures[0]).file), 'utf8'))
		);
		expect(
			data.measurements.every(
				(item) => item.samples === 1 && item.workload === 'one-owned-operation'
			)
		).toBe(true);
	});
});

test('a completed source scope records actual elapsed work and process memory once', async () => {
	await isolatedProfileCapture(async () => {
		const profiler = new PerformanceProfileService();
		const finish = profiler.beginScope(input);
		const fields = Array.from({ length: 200 }, (_, index) => ['field-' + index, index]);
		await Promise.resolve();
		finish();
		finish();
		expect(fields).toHaveLength(200);
		const measurements = profiler.flush();
		expect(measurements).toHaveLength(2);
		expect(
			measurements.every((item) => item.samples === 1 && item.value !== null && item.value >= 0)
		).toBe(true);
		expect(measurements[0].method).toContain('completed source scopes');
		expect(measurements[1].value).toBeGreaterThan(0);
		expect(profiler.flush()).toEqual([]);
	});
});

test('incomplete source scopes and invalid subjects never become successful samples', async () => {
	await isolatedProfileCapture(async () => {
		const profiler = new PerformanceProfileService();
		profiler.beginScope(input);
		expect(() => profiler.beginScope({ ...input, unit: '' })).toThrow();
		expect(profiler.flush()).toEqual([]);
	});
});

test('child scopes retain actual child RSS and reject failed invocations', async () => {
	await isolatedProfileCapture(async (directory) => {
		const input = {
			units: ['script.child-fixture'],
			workload: 'cold-node-process',
			target: 'module' as const,
			command: [process.execPath, '-e', 'console.log(process.memoryUsage().rss)'],
			cwd: process.cwd()
		};
		const references: number[] = [];
		for (let index = 0; index < 2; index++) {
			const result = await measureProcess(input, runCommand);
			references.push(Number(result.stdout.trim()));
		}
		const failed = await measureProcess(
			{ ...input, command: [process.execPath, '-e', 'process.exit(2)'], expectSuccess: false },
			runCommand
		);
		expect(failed.exitCode).toBe(2);
		const captures = (await readFile(join(directory, 'captures.ndjson'), 'utf8'))
			.trim()
			.split('\n')
			.map((line) => JSON.parse(line));
		expect(captures).toHaveLength(2);
		expect(new Set(captures.map((capture) => capture.file)).size).toBe(2);
		for (const [index, capture] of captures.entries()) {
			const data = benchmarkCaptureSchema.parse(
				JSON.parse(await readFile(join(directory, capture.file), 'utf8'))
			);
			const [time, memory] = data.measurements;
			expect(time.metric).toBe('latency-process-ms');
			expect(time.value).toBeGreaterThan(0);
			expect(memory.value).toBeGreaterThan(references[index] / 2);
			expect(memory.value).toBeLessThan(references[index] * 8);
			expect(memory.method).toContain('actual child process');
			expect(
				data.measurements.every((item) => item.samples === 1 && item.target === 'module')
			).toBe(true);
		}
	});
});
