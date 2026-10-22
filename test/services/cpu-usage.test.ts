import { observedTaskOperation } from '../support/taskProfiles';
import { expect, test } from 'vitest';
import { CpuUsageService } from '../../src/services/cpu-usage-service/CpuUsageService';
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
	const first = service.snapshot(),
		second = service.snapshot();
	expect(first).toBe(second);
	const [a, b] = await Promise.all([
		observedTaskOperation('service.cpu-usage', 'shared-snapshot-synthetic-counters', () => first),
		second
	]);
	expect(a).toBe(b);
	expect(calls).toBe(2);
	expect(a.machinePercent).toBe(50);
});
