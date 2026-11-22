import type { Job, Cases } from './repository.resource-queue.test.types';
import type { ResourceQueueRepository } from '../../src/services/execution-runtimes/resource-queue-service/ResourceQueueRepository';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

export const now = 1794737700000;

export const managedJob: Job = {
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

export const batchJob: Job = {
	...managedJob,
	id: '6f1c2b7e-4a3d-4c8e-9b2a-1d5e7f9a0b13',
	priority: 'agent-test',
	cpus: 2,
	memoryMiB: 1024
};

/** Records one state's named cases as its examples trace. */
export function recordState(symbol: string, state: string, cases: Cases): void {
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

export function addJobs(queue: ResourceQueueRepository): void {
	expect(queue.add(managedJob)).toBeUndefined();
	expect(queue.add(batchJob)).toBeUndefined();
	const jobs = queue.all();
	expect(jobs).toEqual([
		{ ...managedJob, sequence: 1 },
		{ ...batchJob, sequence: 2 }
	]);
	recordState('ResourceQueueRepository.add', 'adds-jobs-and-lists-them-in-sequence-order', [
		{ name: 'add stores the managed job and returns no value', input: managedJob, output: null },
		{ name: 'add stores the batch job after it', input: batchJob, output: null },
		{ name: 'all lists both jobs in sequence order', input: {}, output: jobs }
	]);
}
