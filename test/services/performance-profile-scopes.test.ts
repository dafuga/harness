import { expect, test } from 'vitest';
import { PerformanceProfileService } from '../../src/services/PerformanceProfileService';
import { isolatedProfileCapture } from '../support/taskProfiles';

const input = { unit: 'function.schema-fixture', workload: 'initialize-fields' };

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
