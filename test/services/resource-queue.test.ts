import { setTimeout as delay } from 'node:timers/promises';
import { afterEach, expect, test } from 'vitest';
import { resourceRequestSchema } from '../../src/core/execution-runtimes/resourceTypes';
import { observeResources, resourceQueueFixture, snapshot } from '../support/resourceFixture';
const cleanup: Array<() => void> = [];
afterEach(() => {
	cleanup.splice(0).forEach((f) => f());
});
test('queued cancellation releases reservations without ever starting the callback', async () => {
	const observe = observeResources(['service.resource-monitor'], 'queued-admission-and-cleanup');
	const { service } = resourceQueueFixture(cleanup),
		abort = new AbortController();
	let started = false;
	let release!: () => void;
	const hold = new Promise<void>((resolve) => {
		release = resolve;
	});
	const running = service.run(resourceRequestSchema.parse({ cpus: 6 }), () => hold);
	while (!service.queue.all().some((j) => j.state === 'running')) await delay(10);
	const waiting = service.run(
		resourceRequestSchema.parse({ cpus: 6 }),
		async () => {
			started = true;
		},
		{ signal: abort.signal }
	);
	const rejected = expect(waiting).rejects.toThrow();
	await delay(30);
	abort.abort();
	await rejected;
	expect(started).toBe(false);
	expect(service.queue.all()).toHaveLength(1);
	try {
		const timedOut = service.run(
			resourceRequestSchema.parse({ cpus: 6 }),
			async () => {
				started = true;
			},
			{ waitTimeoutMs: 300 }
		);
		await expect(timedOut).rejects.toThrow(
			'Resource queue wait timed out; last reason: Waiting for CPU and memory reservations'
		);
		await expect(timedOut).rejects.toThrow('CPU available 10/10 cores');
		await expect(timedOut).rejects.toThrow('memory available 16384/16384 MiB');
		await expect(timedOut).rejects.toThrow('request 6 cores/512 MiB');
		await expect(timedOut).rejects.toThrow('running reservations 6 cores/512 MiB');
		expect(started).toBe(false);
		expect(service.queue.all()).toHaveLength(1);
	} finally {
		release();
		await running;
	}
	expect(service.queue.all()).toEqual([]);
	observe();
});
test('pressure is observed during a running task; that task finishes and subsequent work waits', async () => {
	const state = resourceQueueFixture(cleanup);
	let nextStarted = false;
	await state.service.run(resourceRequestSchema.parse({}), async () => {
		state.pressure(true);
		await delay(550);
		expect(state.service.queue.all()[0].notice).toContain('Memory pressure');
		const abort = new AbortController();
		const waiting = state.service.run(
			resourceRequestSchema.parse({ priority: 'agent-test' }),
			async () => {
				nextStarted = true;
			},
			{ signal: abort.signal }
		);
		const rejected = expect(waiting).rejects.toThrow();
		await delay(280);
		abort.abort();
		await rejected;
		expect(nextStarted).toBe(false);
		const timedOut = state.service.run(
			resourceRequestSchema.parse({ priority: 'agent-test' }),
			async () => {
				nextStarted = true;
			},
			{ waitTimeoutMs: 300 }
		);
		await expect(timedOut).rejects.toThrow(
			'Resource queue wait timed out; last reason: Memory pressure is critical'
		);
		expect(nextStarted).toBe(false);
		expect(state.service.queue.all()).toHaveLength(1);
	});
	expect(state.service.queue.all()).toEqual([]);
	state.pressure(false);
	await delay(260);
	await state.service.run(resourceRequestSchema.parse({}), async () => {
		nextStarted = true;
	});
	expect(nextStarted).toBe(true);
});
test('forged inherited reservations and impossible requests do not execute work', async () => {
	const { service } = resourceQueueFixture(cleanup);
	let started = false;
	await expect(
		service.run(
			resourceRequestSchema.parse({}),
			async () => {
				started = true;
			},
			{ env: { HARNESS_RESOURCE_LEASE: 'forged' } }
		)
	).rejects.toThrow('Invalid inherited');
	await expect(
		service.run(resourceRequestSchema.parse({ cpus: 10 }), async () => {
			started = true;
		})
	).rejects.toThrow('exceeds usable capacity');
	expect(started).toBe(false);
	expect(service.queue.all()).toEqual([]);
});
test('a validated nested task uses its ancestor budget rather than deadlocking', async () => {
	const { service } = resourceQueueFixture(cleanup);
	await service.run(resourceRequestSchema.parse({}), async (context) => {
		expect(context.env.CARGO_BUILD_JOBS).toBe('1');
		expect(context.env.GOMAXPROCS).toBe('1');
		await service.run(
			resourceRequestSchema.parse({}),
			async () => {
				expect(service.queue.all()).toHaveLength(2);
			},
			{ env: context.env }
		);
		await expect(
			service.run(resourceRequestSchema.parse({ cpus: 2 }), async () => {}, { env: context.env })
		).rejects.toThrow('exceeds its parent');
	});
	expect(service.queue.all()).toEqual([]);
});

test('parallel nested tasks share a bounded parent budget instead of each borrowing the full reservation', async () => {
	const { service } = resourceQueueFixture(cleanup);
	let firstStarted = false,
		secondStarted = false,
		release!: () => void;
	await service.run(resourceRequestSchema.parse({}), async (context) => {
		const hold = new Promise<void>((resolve) => {
			release = resolve;
		});
		const first = service.run(
			resourceRequestSchema.parse({}),
			async () => {
				firstStarted = true;
				await hold;
			},
			{ env: context.env }
		);
		while (!firstStarted) await delay(10);
		const second = service.run(
			resourceRequestSchema.parse({}),
			async () => {
				secondStarted = true;
			},
			{ env: context.env }
		);
		await delay(80);
		const overlapped = secondStarted;
		release();
		await Promise.all([first, second]);
		expect(overlapped).toBe(false);
		expect(secondStarted).toBe(true);
	});
});

test('a future cached sample is replaced rather than pinning admission after a clock jump', async () => {
	const { service } = resourceQueueFixture(cleanup);
	service.queue.saveSnapshot(snapshot({ sampledAt: Date.now() + 60000 }));
	expect((await service.snapshot()).sampledAt).toBeLessThanOrEqual(Date.now());
	await service.run(resourceRequestSchema.parse({}), async () => {});
	expect(service.queue.all()).toEqual([]);
});

test('a queued sibling cannot block the descendant needed to release its ancestor reservation', async () => {
	const { service } = resourceQueueFixture(cleanup),
		order: string[] = [];
	let sibling: Promise<void> | undefined;
	await service.run(resourceRequestSchema.parse({}), async (root) => {
		try {
			await service.run(
				resourceRequestSchema.parse({}),
				async (child) => {
					sibling = service.run(
						resourceRequestSchema.parse({}),
						async () => {
							order.push('sibling');
						},
						{ env: root.env }
					);
					while (!service.queue.all().some((j) => j.parentId === root.id && j.state === 'queued'))
						await delay(5);
					await service.run(
						resourceRequestSchema.parse({}),
						async () => {
							order.push('descendant');
						},
						{ env: child.env, waitTimeoutMs: 1000 }
					);
				},
				{ env: root.env }
			);
		} finally {
			await sibling;
		}
	});
	expect(order).toEqual(['descendant', 'sibling']);
	expect(service.queue.all()).toEqual([]);
});
