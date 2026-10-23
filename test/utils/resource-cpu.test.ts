import { expect, test } from 'vitest';
import { resourceCpu } from '../../src/services/execution-runtimes/resource-queue-service/resource-monitor-service/host-resources-adapter/resourceCpu';
const before = {
	at: 1000,
	cores: 10,
	affinity: 10,
	idle: 100,
	total: 1000,
	limits: { cores: 2, cpuUsedUs: 1000 }
};
const after = {
	...before,
	at: 2000,
	idle: 1100,
	total: 2000,
	limits: { cores: 2, cpuUsedUs: 1501000 }
};
test('host idle and container quota saturation both limit available cores', () => {
	expect(resourceCpu(before, after)).toMatchObject({
		cpuUsedPercent: 0,
		usableCores: 2,
		cpuAvailableCores: 0.5
	});
	expect(
		resourceCpu({ ...before, limits: {} }, { ...after, affinity: 4, limits: {} }).cpuAvailableCores
	).toBe(4);
});
test('counter resets and quota changes require another fresh measurement', () => {
	expect(() => resourceCpu(before, { ...after, idle: 99 })).toThrow('Invalid CPU interval');
	expect(() => resourceCpu(before, { ...after, limits: { cores: 1, cpuUsedUs: 1501000 } })).toThrow(
		'quota changed'
	);
	expect(() => resourceCpu(before, { ...after, limits: { cores: 2, cpuUsedUs: 10 } })).toThrow(
		'quota changed'
	);
});
