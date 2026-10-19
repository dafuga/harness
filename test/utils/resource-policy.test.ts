import { expect, test } from 'vitest';
import {
	resourcePolicy,
	resourcePressure,
	impossibleRequest
} from '../../src/utils/resourcePolicy';
import { resourceRequestSchema, mib } from '../../src/core/resourceTypes';
import { config, snapshot, job } from '../support/resourceFixture';
test('CPU is a fraction of overall usable capacity and admission retains ten percent', () => {
	const task = job();
	expect(
		resourcePolicy([task], snapshot({ cpuAvailableCores: 2, cpuUsedPercent: 80 }), config).granted
	).toEqual([task.id]);
	expect(
		resourcePolicy([task], snapshot({ cpuAvailableCores: 1, cpuUsedPercent: 90 }), config).granted
	).toEqual([]);
	expect(resourcePressure(snapshot({ cpuAvailableCores: 0.9, cpuUsedPercent: 91 }), config)).toBe(
		'CPU reserve is exhausted'
	);
});
test('memory admission retains both the percentage reserve and the absolute floor', () => {
	const task = job({ memoryMiB: 512 });
	expect(
		resourcePolicy([task], snapshot({ memoryAvailableBytes: 2560 * mib }), config).granted
	).toEqual([task.id]);
	expect(
		resourcePolicy([task], snapshot({ memoryAvailableBytes: 2048 * mib }), config).granted
	).toEqual([]);
	expect(
		resourcePolicy(
			[task],
			snapshot({ memoryTotalBytes: 64 * 1024 * mib, memoryAvailableBytes: 6.5 * 1024 * mib }),
			config
		).granted
	).toEqual([]);
});
test('agent tests precede coding and environment checks, with FIFO within each priority', () => {
	const environment = job({ priority: 'environment', sequence: 1 }),
		coding = job({ priority: 'coding', sequence: 2 }),
		later = job({ priority: 'agent-test', sequence: 4 }),
		first = job({ priority: 'agent-test', sequence: 3 });
	expect(
		resourcePolicy(
			[environment, coding, later, first],
			snapshot({ cpuAvailableCores: 2, cpuUsedPercent: 80 }),
			config
		).granted
	).toEqual([first.id]);
	expect(
		resourcePolicy(
			[environment, coding],
			snapshot({ cpuAvailableCores: 2, cpuUsedPercent: 80 }),
			config
		).granted
	).toEqual([coding.id]);
});
test('existing reservations account for work which has not reached its peak yet', () => {
	const running = job({ state: 'running', cpus: 5 }),
		waiting = job({ cpus: 5, sequence: 2 });
	expect(resourcePolicy([running, waiting], snapshot(), config).granted).toEqual([]);
	expect(
		resourcePolicy(
			[job({ state: 'running', memoryMiB: 12000 }), job({ sequence: 2, memoryMiB: 3000 })],
			snapshot(),
			config
		).granted
	).toEqual([]);
});
test.each([
	{ status: 'unavailable' as const },
	{ sampledAt: Date.now() - 30000 },
	{ sampledAt: Date.now() + 30000 },
	{ sampledAt: NaN },
	{ cpuAvailableCores: NaN },
	{ cpuUsedPercent: NaN },
	{ cpuUsedPercent: null },
	{ memoryAvailableBytes: NaN },
	{ memoryPressure: 'warning' as const },
	{ memoryPressure: 'critical' as const },
	{ memoryPressure: 'unknown' as const }
])('unknown, stale and pressured telemetry holds new work: %j', (changes) => {
	expect(resourcePolicy([job()], snapshot(changes), config).granted).toEqual([]);
});
test('requests which can never fit fail instead of waiting forever', () => {
	expect(impossibleRequest(resourceRequestSchema.parse({ cpus: 10 }), snapshot(), config)).toBe(
		true
	);
	expect(
		impossibleRequest(resourceRequestSchema.parse({ memoryMiB: 16000 }), snapshot(), config)
	).toBe(true);
	expect(impossibleRequest(resourceRequestSchema.parse({ cpus: 1 }), snapshot(), config)).toBe(
		false
	);
});
