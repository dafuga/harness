import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	hostCpuCounters,
	resourceCpu
} from '../../src/services/execution-runtimes/resource-queue-service/resource-monitor-service/host-resources-adapter/resourceCpu';

const previous = {
	at: 4200.5,
	limits: { cores: 4, cpuUsedUs: 12000000 },
	cores: 8,
	affinity: 4,
	idle: 270000,
	total: 460000
};
const current = {
	at: 4400.5,
	limits: { cores: 4, cpuUsedUs: 12300000 },
	cores: 8,
	affinity: 4,
	idle: 271300,
	total: 461600
};

test('Calculates available cores within affinity and quota limits', () => {
	const actualHost = hostCpuCounters();
	const summary = resourceCpu(previous, current);
	const quotaLimited = resourceCpu(
		{ ...previous, limits: { cores: 4, cpuUsedUs: 12000000 } },
		{ ...current, limits: { cores: 4, cpuUsedUs: 12700000 } }
	);
	expect(summary).toEqual({
		logicalCores: 8,
		usableCores: 4,
		cpuUsedPercent: 18.75,
		cpuAvailableCores: 2.5
	});
	expect(actualHost).toMatchObject({
		at: expect.any(Number),
		limits: expect.any(Object),
		cores: expect.any(Number),
		affinity: expect.any(Number),
		idle: expect.any(Number),
		total: expect.any(Number)
	});
	expect(quotaLimited.cpuAvailableCores).toBe(0.5);
	recordExampleCases(
		{
			unitId: 'function.resource-cpu',
			symbol: 'resourceCpu',
			state: 'calculates-available-cores-within-affinity-and-quota-limits',
			evidence: 'examples-cases',
			file: 'calculates-available-cores-within-affinity-and-quota-limits.json'
		},
		[
			{
				name: 'affinity and quota bound available cores',
				input: { previous, current },
				output: summary
			},
			{
				name: 'measured quota saturation bounds available cores',
				input: {
					previous: { ...previous, limits: { cores: 4, cpuUsedUs: 12000000 } },
					current: { ...current, limits: { cores: 4, cpuUsedUs: 12700000 } }
				},
				output: quotaLimited
			}
		]
	);
});

test('Rejects invalid CPU intervals', () => {
	const invalid = { ...current, total: previous.total };
	expect(() => resourceCpu(previous, invalid)).toThrow('Invalid CPU interval');
	recordExampleCases(
		{
			unitId: 'function.resource-cpu',
			symbol: 'resourceCpu',
			state: 'rejects-invalid-cpu-intervals',
			evidence: 'examples-cases',
			file: 'rejects-invalid-cpu-intervals.json'
		},
		[
			{
				name: 'total time does not advance',
				input: { previous, current: invalid },
				error: 'Invalid CPU interval'
			}
		]
	);
});
