import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { ResourceQueueService } from '../../src/services/execution-runtimes/ResourceQueueService';

const sample = () => ({
	status: 'available' as const,
	sampledAt: Date.now(),
	logicalCores: 16,
	usableCores: 8,
	cpuUsedPercent: 25,
	cpuAvailableCores: 8,
	memoryTotalBytes: 8589934592,
	memoryAvailableBytes: 6442450944,
	memoryPressure: 'normal' as const
});

test('Returns the current resource snapshot', async () => {
	await withTempDir('resource-queue-snapshot-', async (home) => {
		const expected = sample();
		const service = new ResourceQueueService({ home, monitor: { sample: async () => expected } });
		try {
			const result = await service.snapshot();
			expect(result).toEqual(expected);
			recordExampleCases(
				{
					unitId: 'service.resource-queue',
					symbol: 'snapshot',
					state: 'returns-the-current-resource-snapshot',
					evidence: 'examples-cases',
					file: 'returns-the-current-resource-snapshot.json'
				},
				[{ name: 'returns the monitor sample unchanged', input: {}, output: result }]
			);
		} finally {
			service.close();
		}
	});
});

test('Runs an admitted resource request and releases its lease', async () => {
	await withTempDir('resource-queue-run-', async (home) => {
		const service = new ResourceQueueService({ home, monitor: { sample: async () => sample() } });
		const input = {
			priority: 'coding' as const,
			cpus: 2,
			memoryMiB: 4096,
			label: 'Unit test worker'
		};
		try {
			const output = await service.run(
				input,
				async (context) => ({
					status: 'done',
					hasLease: context.env.HARNESS_RESOURCE_LEASE === context.id,
					hasResourceHome: context.env.HARNESS_RESOURCES_HOME === home
				}),
				{ env: {} }
			);
			expect(output).toEqual({ status: 'done', hasLease: true, hasResourceHome: true });
			expect(service.queue.all()).toHaveLength(0);
			recordExampleCases(
				{
					unitId: 'service.resource-queue',
					symbol: 'run',
					state: 'runs-an-admitted-resource-request-and-releases-its-lease',
					evidence: 'examples-cases',
					file: 'runs-an-admitted-resource-request-and-releases-its-lease.json'
				},
				[
					{
						name: 'runs the action under its resource context and removes its queue entry',
						input,
						output
					}
				]
			);
		} finally {
			service.close();
		}
	});
});

test('Throws ResourceQueueError when the wait timeout is invalid', async () => {
	await withTempDir('resource-queue-timeout-', async (home) => {
		const service = new ResourceQueueService({ home, monitor: { sample: async () => sample() } });
		const input = {
			priority: 'coding' as const,
			cpus: 2,
			memoryMiB: 4096,
			label: 'Unit test worker'
		};
		try {
			const action = () =>
				service.run(input, async () => ({ status: 'done' }), { waitTimeoutMs: 0 });
			await expect(action()).rejects.toThrow('Invalid resource queue wait timeout');
			recordExampleCases(
				{
					unitId: 'service.resource-queue',
					symbol: 'run',
					state: 'throws-resourcequeueerror-when-the-wait-timeout-is-invalid',
					evidence: 'examples-cases',
					file: 'throws-resourcequeueerror-when-the-wait-timeout-is-invalid.json'
				},
				[
					{
						name: 'rejects zero wait timeout',
						input: { ...input, waitTimeoutMs: 0 },
						error: 'Invalid resource queue wait timeout'
					}
				]
			);
		} finally {
			service.close();
		}
	});
});

test('Throws ResourceQueueError when the inherited lease is invalid', async () => {
	await withTempDir('resource-queue-parent-', async (home) => {
		const service = new ResourceQueueService({
			home,
			env: {},
			monitor: { sample: async () => sample() }
		});
		const input = { priority: 'coding' as const, cpus: 1, memoryMiB: 512, label: 'Nested worker' };
		try {
			const action = () =>
				service.run(input, async () => ({ status: 'done' }), {
					env: { HARNESS_RESOURCE_LEASE: '00000000-0000-4000-8000-000000000000' }
				});
			await expect(action()).rejects.toThrow('Invalid inherited resource lease');
			recordExampleCases(
				{
					unitId: 'service.resource-queue',
					symbol: 'run',
					state: 'throws-resourcequeueerror-when-the-inherited-lease-is-invali',
					evidence: 'examples-cases',
					file: 'throws-resourcequeueerror-when-the-inherited-lease-is-invali.json'
				},
				[
					{
						name: 'rejects an unknown parent lease',
						input: { ...input, inheritedLease: '00000000-0000-4000-8000-000000000000' },
						error: 'Invalid inherited resource lease'
					}
				]
			);
		} finally {
			service.close();
		}
	});
});

test('Throws ResourceQueueError when the queue is full', async () => {
	await withTempDir('resource-queue-full-', async (home) => {
		const service = new ResourceQueueService({
			home,
			env: {},
			monitor: { sample: async () => sample() }
		});
		const input = {
			priority: 'coding' as const,
			cpus: 1,
			memoryMiB: 512,
			label: 'Unit test worker'
		};
		try {
			for (let index = 0; index < 512; index += 1)
				service.queue.add({
					...input,
					id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
					ownerPid: process.pid,
					ownerStarted: 'fixture',
					state: 'queued',
					createdAt: 1,
					heartbeatAt: 1,
					notice: null
				});
			const action = () => service.run(input, async () => ({ status: 'done' }));
			await expect(action()).rejects.toThrow('Resource queue is full');
			recordExampleCases(
				{
					unitId: 'service.resource-queue',
					symbol: 'run',
					state: 'throws-resourcequeueerror-when-the-queue-is-full',
					evidence: 'examples-cases',
					file: 'throws-resourcequeueerror-when-the-queue-is-full.json'
				},
				[
					{
						name: 'rejects admission at 512 queued records',
						input: { ...input, queuedRecords: 512 },
						error: 'Resource queue is full'
					}
				]
			);
		} finally {
			service.close();
		}
	});
});
