import { expect, test } from 'vitest';
import { CpuUsageService } from '../../src/services/CpuUsageService';
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
});
