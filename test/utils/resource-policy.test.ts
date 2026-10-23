import { expect, test } from 'vitest';
import { mib, resourceRequestSchema } from '../../src/core/execution-runtimes/resourceTypes';
import {
	impossibleRequest,
	resourcePolicy,
	resourcePressure
} from '../../src/services/execution-runtimes/resource-queue-service/resource-policy/resourcePolicy';
import { config, job, snapshot } from '../support/resourceFixture';
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

test.each([{ cpuAvailableCores: 2.5, cpuUsedPercent: 75 }, { memoryAvailableBytes: 2560 * mib }])(
	'nested admissions preserve live system headroom as well as the parent budget: %j',
	(changes) => {
		const parent = job({ state: 'running', cpus: 4, memoryMiB: 12000 });
		const first = job({ parentId: parent.id, sequence: 2 }),
			second = job({ parentId: parent.id, sequence: 3 });
		expect(resourcePolicy([parent, first, second], snapshot(changes), config).granted).toEqual([
			first.id
		]);
	}
);
test('nested agent tests precede environment checks across different active parents', () => {
	const environment = job({ state: 'running', cpus: 2 }),
		coding = job({ state: 'running', cpus: 2, sequence: 2 });
	const background = job({ parentId: environment.id, priority: 'environment', sequence: 3 });
	const agent = job({ parentId: coding.id, priority: 'agent-test', sequence: 4 });
	expect(
		resourcePolicy(
			[environment, coding, background, agent],
			snapshot({ cpuAvailableCores: 2.5, cpuUsedPercent: 75 }),
			config
		).granted
	).toEqual([agent.id]);
});

test.each([2, 3, 5])(
	'eligible descendants can finish when an older sibling waits behind %i occupied ancestor pools',
	(depth) => {
		const ancestors = [job({ state: 'running', memoryMiB: 2048 })];
		for (let i = 1; i < depth; i++)
			ancestors.push(
				job({ state: 'running', memoryMiB: 2048, parentId: ancestors[i - 1].id, sequence: i + 1 })
			);
		const sibling = job({ parentId: ancestors[0].id, sequence: depth + 1 });
		const descendant = job({ parentId: ancestors.at(-1)!.id, sequence: depth + 2 });
		expect(resourcePolicy([...ancestors, sibling, descendant], snapshot(), config).granted).toEqual(
			[descendant.id]
		);
	}
);
