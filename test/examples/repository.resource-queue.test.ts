import { test } from 'vitest';
import type {
	ResourceConfig,
	ResourceJob,
	ResourceSnapshot
} from '../../src/core/execution-runtimes/resourceTypes';
import { ResourceQueueRepository } from '../../src/services/execution-runtimes/resource-queue-service/ResourceQueueRepository';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

type Job = Omit<ResourceJob, 'sequence'>;
type Cases = Parameters<typeof recordExampleCases>[1];

const now = 1794737700000;
const missingId = '6e2f9a1c-3b7d-4e5a-8c21-9f0d4b6a7e35';
const telemetryNotice = 'Resource telemetry is unavailable or stale';
const managedJob: Job = {
	id: '550e8400-e29b-41d4-a716-446655440000',
	priority: 'coding',
	cpus: 1,
	memoryMiB: 512,
	label: 'Managed work',
	ownerPid: 12345,
	ownerStarted: '2026-11-15T10:15:00.000Z',
	state: 'queued',
	createdAt: now,
	heartbeatAt: now,
	notice: null
};
const batchJob: Job = {
	...managedJob,
	id: '6f1c2b7e-4a3d-4c8e-9b2a-1d5e7f9a0b13',
	priority: 'agent-test',
	cpus: 2,
	memoryMiB: 1024
};
const invalidJob: Job = { ...managedJob, cpus: 0 };
const running: Partial<ResourceJob> = { state: 'running', heartbeatAt: now + 5000, notice: null };
const worker: Partial<ResourceJob> = { workerPid: 34567 };
const sample: ResourceSnapshot = {
	status: 'available',
	sampledAt: now,
	logicalCores: 8,
	usableCores: 8,
	cpuUsedPercent: 12.5,
	cpuAvailableCores: 7,
	memoryTotalBytes: 17179869184,
	memoryAvailableBytes: 12884901888,
	memoryPressure: 'normal'
};
const stale: ResourceSnapshot = { ...sample, sampledAt: now - 6000 };
const newer: ResourceSnapshot = { ...sample, sampledAt: now + 5000 };
const replacement: ResourceSnapshot = { ...sample, sampledAt: now + 10000 };
const future: ResourceSnapshot = { ...sample, sampledAt: 4102444800000 };
const config: ResourceConfig = {
	schemaVersion: 1,
	cpuReservePercent: 10,
	memoryReservePercent: 10,
	minMemoryReserveMiB: 2048,
	pollMs: 1000,
	staleSampleMs: 5000
};

/** Opens the queue at a temporary home, runs one state against it and closes it again. */
function withQueue(prefix: string, run: (queue: ResourceQueueRepository) => void): Promise<void> {
	return withTempDir(prefix, (home) => {
		const queue = new ResourceQueueRepository(home);
		try {
			run(queue);
		} finally {
			queue.close();
		}
	});
}

/** Records one state's named cases as its examples trace. */
function recordState(symbol: string, state: string, cases: Cases): void {
	recordExampleCases(
		{
			unitId: 'repository.resource-queue',
			symbol,
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

/** The error a call throws, or undefined when it returns normally. */
function thrownBy(action: () => unknown): unknown {
	try {
		action();
	} catch (error) {
		return error;
	}
	return undefined;
}

function addJobs(queue: ResourceQueueRepository): void {
	expect(queue.add(managedJob)).toBeUndefined();
	expect(queue.add(batchJob)).toBeUndefined();
	const jobs = queue.all();
	expect(jobs).toEqual([{ ...managedJob, sequence: 1 }, { ...batchJob, sequence: 2 }]);
	recordState('ResourceQueueRepository.add', 'adds-jobs-and-lists-them-in-sequence-order', [
		{ name: 'add stores the managed job and returns no value', input: managedJob, output: null },
		{ name: 'add stores the batch job after it', input: batchJob, output: null },
		{ name: 'all lists both jobs in sequence order', input: {}, output: jobs }
	]);
}

test('Adds jobs and lists them in sequence order', () =>
	withQueue('resource-queue-add-', addJobs));

function patchJob(queue: ResourceQueueRepository): void {
	queue.add(managedJob);
	expect(queue.patch(managedJob.id, running)).toBeUndefined();
	expect(queue.patch(missingId, worker)).toBeUndefined();
	const jobs = queue.all();
	expect(jobs).toEqual([{ ...managedJob, ...running, sequence: 1 }]);
	recordState('ResourceQueueRepository.patch', 'patches-a-stored-job-and-ignores-an-unknown-id', [
		{
			name: 'patch merges the running update into the job',
			input: { id: managedJob.id, changes: running },
			output: null
		},
		{ name: 'unknown id is a no-op', input: { id: missingId, changes: worker }, output: null },
		{ name: 'all returns the one job with the merged fields', input: {}, output: jobs }
	]);
}

test('Patches a stored job and ignores an unknown id', () =>
	withQueue('resource-queue-patch-', patchJob));

function removeJobs(queue: ResourceQueueRepository): void {
	queue.add(managedJob);
	queue.add(batchJob);
	expect(queue.remove(managedJob.id)).toBeUndefined();
	expect(queue.remove(missingId)).toBeUndefined();
	const jobs = queue.all();
	expect(jobs.map((job) => job.id)).toEqual([batchJob.id]);
	recordState('ResourceQueueRepository.remove', 'removes-only-the-job-whose-id-matches', [
		{ name: 'remove deletes the job whose id matches', input: { id: managedJob.id }, output: null },
		{ name: 'a missing id removes nothing', input: { id: missingId }, output: null },
		{ name: 'all lists only the job that remains', input: {}, output: jobs }
	]);
}

test('Removes only the job whose id matches', () =>
	withQueue('resource-queue-remove-', removeJobs));

function scheduleJobs(queue: ResourceQueueRepository): void {
	queue.add(managedJob);
	queue.add(batchJob);
	const waiting = queue.schedule(stale, config, now);
	expect(waiting.map((job) => job.state)).toEqual(['queued', 'queued']);
	expect(waiting.map((job) => job.notice)).toEqual([telemetryNotice, telemetryNotice]);
	const granted = queue.schedule(sample, config, now);
	expect(granted.map((job) => job.state)).toEqual(['running', 'running']);
	expect(granted.map((job) => job.notice)).toEqual([null, null]);
	recordState(
		'ResourceQueueRepository.schedule',
		'notices-queued-work-on-stale-telemetry-then-grants-it',
		[
			{
				name: 'stale telemetry leaves both jobs queued with a notice',
				input: { sample: stale, config, now },
				output: waiting
			},
			{
				name: 'fresh telemetry grants both jobs and clears notices',
				input: { sample, config, now },
				output: granted
			}
		]
	);
}

test('Notices queued work on stale telemetry then grants it', () =>
	withQueue('resource-queue-schedule-', scheduleJobs));

function keepSnapshot(queue: ResourceQueueRepository): void {
	queue.saveSnapshot(newer);
	const stored = queue.snapshot();
	queue.saveSnapshot(sample);
	const afterSkip = queue.snapshot();
	queue.saveSnapshot(future);
	const afterFuture = queue.snapshot();
	queue.saveSnapshot(replacement);
	const recovered = queue.snapshot();
	expect([stored, afterSkip, afterFuture, recovered]).toEqual([newer, newer, future, replacement]);
	recordState(
		'ResourceQueueRepository.saveSnapshot',
		'keeps-the-newest-snapshot-across-older-and-future-samples',
		[
			{ name: 'saveSnapshot stores the newer sample', input: newer, output: null },
			{ name: 'saveSnapshot skips an older sample', input: sample, output: null },
			{ name: 'snapshot keeps the newer sample', input: {}, output: afterSkip },
			{ name: 'saveSnapshot stores a future-dated sample', input: future, output: null },
			{ name: 'snapshot returns the future-dated sample', input: {}, output: afterFuture },
			{ name: 'saveSnapshot replaces it with a past sample', input: replacement, output: null },
			{ name: 'snapshot returns the replacement', input: {}, output: recovered }
		]
	);
}

test('Keeps the newest snapshot across older and future samples', () =>
	withQueue('resource-queue-snapshot-', keepSnapshot));

function rejectInvalidJob(queue: ResourceQueueRepository): void {
	expect(queue.add(invalidJob)).toBeUndefined();
	const readError = thrownBy(() => queue.all());
	const writeError = thrownBy(() => queue.patch(invalidJob.id, worker));
	const readName = (readError as Error).name;
	const writeName = (writeError as Error).name;
	expect([readName, writeName]).toEqual(['ZodError', 'ZodError']);
	queue.remove(invalidJob.id);
	const jobs = queue.all();
	expect(jobs).toEqual([]);
	recordState('ResourceQueueRepository.all', 'rejects-a-stored-job-that-fails-the-job-schema', [
		{ name: 'add stores a job with zero cpus unchecked', input: invalidJob, output: null },
		{ name: 'all rejects the stored row', input: {}, error: { name: readName } },
		{
			name: 'patch rethrows the schema error',
			input: { id: invalidJob.id, changes: worker },
			error: { name: writeName }
		},
		{ name: 'remove deletes the rejected row', input: { id: invalidJob.id }, output: null },
		{ name: 'all reads the empty queue again', input: {}, output: jobs }
	]);
}

test('Rejects a stored job that fails the job schema', () =>
	withQueue('resource-queue-schema-', rejectInvalidJob));
