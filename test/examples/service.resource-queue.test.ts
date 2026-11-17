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
