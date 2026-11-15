import { expect, test } from 'vitest';
import { CpuProcessAdapter } from '../../src/services/development-tooling/cpu-usage-service/cpu-process-adapter/CpuProcessAdapter';
import { CpuUsageService } from '../../src/services/development-tooling/cpu-usage-service/CpuUsageService';
test('concurrent CPU requests share one sampler', async () => {
	let calls = 0;
	const adapter = {
		sample: async () => {
			calls++;
			return {
				at: calls * 1000,
				cpu: { idle: calls * 500, total: calls * 1000, cores: 1 },
				processes: []
			};
		}
	};
	const service = new CpuUsageService(adapter);
	const [a, b] = await Promise.all([service.snapshot(), service.snapshot()]);
	expect(a).toBe(b);
	expect(calls).toBe(2);
	expect(a.machinePercent).toBe(50);
	if (['darwin', 'linux'].includes(process.platform)) {
		const reading = await new CpuProcessAdapter().sample();
		expect(reading.cpu.cores).toBeGreaterThan(0);
		expect(reading.cpu.total).toBeGreaterThan(0);
	}
});
