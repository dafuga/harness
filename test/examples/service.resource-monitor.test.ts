import { test } from 'vitest';
import type {
	ResourceRequest,
	ResourceSnapshot
} from '../../src/core/execution-runtimes/resourceTypes';
import { ResourceMonitorService } from '../../src/services/execution-runtimes/resource-queue-service/ResourceMonitorService';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

type Queue = ConstructorParameters<typeof ResourceMonitorService>[0]['queue'];

const SAMPLE: ResourceSnapshot = {
	status: 'available',
	sampledAt: 1794700000000,
	logicalCores: 8,
	usableCores: 7.2,
	cpuUsedPercent: 25,
	cpuAvailableCores: 5.4,
	memoryTotalBytes: 17179869184,
	memoryAvailableBytes: 12884901888,
	memoryPressure: 'normal'
};

const JOB_ID = '550e8400-e29b-41d4-a716-446655440001';
const REQUEST: ResourceRequest = { priority: 'coding', cpus: 1.5, memoryMiB: 1536, label: 'Build verification' };

function fakeQueue(state: { previous?: ResourceSnapshot; jobs?: unknown[] }) {
	const patches: Array<{ id: string; fields: Record<string, unknown> }> = [];
	const queue = {
		snapshot: () => state.previous,
		saveSnapshot: () => undefined,
		patch: (id: string, fields: Record<string, unknown>) => {
			patches.push({ id, fields });
		},
		all: () => state.jobs ?? [],
		schedule: () => state.jobs ?? [],
		remove: () => undefined
	};
	return { queue: queue as unknown as Queue, patches };
}

function countingAdapter(counter: { calls: number }, fail = false) {
	return {
		sample: async (): Promise<ResourceSnapshot> => {
			counter.calls += 1;
			if (fail) throw new Error('probe unavailable');
			return SAMPLE;
		}
	};
}

test('Returns the cached snapshot inside the poll interval', async () => {
	await withTempDir('resource-monitor-cache-', async (home) => {
		const previous = { ...SAMPLE, sampledAt: Date.now() };
		const counter = { calls: 0 };
		const service = new ResourceMonitorService({
			home,
			queue: fakeQueue({ previous }).queue,
			adapter: countingAdapter(counter)
		});
		const result = await service.snapshot();

		expect(result).toEqual(previous);
		expect(counter.calls).toBe(0);
		recordExampleCases(
			{
				unitId: 'service.resource-monitor',
				symbol: 'snapshot',
				state: 'returns-the-cached-snapshot-inside-the-poll-interval',
				evidence: 'examples-cases',
				file: 'returns-the-cached-snapshot-inside-the-poll-interval.json'
			},
			[
				{
					name: 'fresh cached snapshot is returned without sampling the adapter',
					input: { sampledAgeMs: 0 },
					output: { sampledCalls: counter.calls, memoryPressure: result.memoryPressure }
				}
			]
		);
	});
});

test('Heartbeat records a hold notice when sampling fails', async () => {
	await withTempDir('resource-monitor-heartbeat-', async (home) => {
		const { queue, patches } = fakeQueue({});
		const counter = { calls: 0 };
		const service = new ResourceMonitorService({
			home,
			queue,
			adapter: countingAdapter(counter, true)
		});
		await service.heartbeat(JOB_ID);

		expect(patches).toHaveLength(1);
		expect(patches[0].id).toBe(JOB_ID);
		expect(patches[0].fields.notice).toBe('Resource monitoring failed; subsequent work is held');
		expect(typeof patches[0].fields.heartbeatAt).toBe('number');
		recordExampleCases(
			{
				unitId: 'service.resource-monitor',
				symbol: 'heartbeat',
				state: 'heartbeat-records-a-hold-notice-when-sampling-fails',
				evidence: 'examples-cases',
				file: 'heartbeat-records-a-hold-notice-when-sampling-fails.json'
			},
			[
				{
					name: 'failed telemetry sample stores the hold notice on the running job',
					input: { id: JOB_ID, adapterError: 'probe unavailable' },
					output: { patchedId: patches[0].id, notice: patches[0].fields.notice }
				}
			]
		);
	});
});

test('Wait admits a queued job once it is scheduled as running', async () => {
	await withTempDir('resource-monitor-admit-', async (home) => {
		const job = {
			id: JOB_ID,
			state: 'running',
			cpus: REQUEST.cpus,
			memoryMiB: REQUEST.memoryMiB,
			heartbeatAt: Date.now(),
			notice: null
		};
		const counter = { calls: 0 };
		const service = new ResourceMonitorService({
			home,
			queue: fakeQueue({ jobs: [job] }).queue,
			adapter: countingAdapter(counter)
		});
		await service.wait(JOB_ID, REQUEST, { waitTimeoutMs: 300000 });

		expect(counter.calls).toBeGreaterThan(0);
		recordExampleCases(
			{
				unitId: 'service.resource-monitor',
				symbol: 'wait',
				state: 'wait-admits-a-queued-job-once-it-is-scheduled-as-running',
				evidence: 'examples-cases',
				file: 'wait-admits-a-queued-job-once-it-is-scheduled-as-running.json'
			},
			[
				{
					name: 'job scheduled as running resolves the wait',
					input: { id: JOB_ID, request: REQUEST, options: { waitTimeoutMs: 300000 } },
					output: { resolved: true, jobState: job.state }
				}
			]
		);
	});
});

test('Wait rejects a request larger than usable capacity', async () => {
	await withTempDir('resource-monitor-impossible-', async (home) => {
		const counter = { calls: 0 };
		const service = new ResourceMonitorService({
			home,
			queue: fakeQueue({ jobs: [] }).queue,
			adapter: countingAdapter(counter)
		});
		const oversized = { ...REQUEST, cpus: 64 };
		let error: unknown;
		try {
			await service.wait(JOB_ID, oversized, { waitTimeoutMs: 300000 });
		} catch (caught) {
			error = caught;
		}

		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toContain('exceeds usable capacity after reserves');
		recordExampleCases(
			{
				unitId: 'service.resource-monitor',
				symbol: 'wait',
				state: 'wait-rejects-a-request-larger-than-usable-capacity',
				evidence: 'examples-cases',
				file: 'wait-rejects-a-request-larger-than-usable-capacity.json'
			},
			[
				{
					name: 'request above usable cores is rejected as impossible',
					input: { id: JOB_ID, request: oversized, options: { waitTimeoutMs: 300000 } },
					error: { name: (error as Error).name, message: (error as Error).message }
				}
			]
		);
	});
});
