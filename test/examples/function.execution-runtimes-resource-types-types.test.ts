import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import type {
	ResourceConfig,
	ResourceRequest,
	ResourceSnapshot,
	ResourceJob,
	ResourceContext
} from '../../src/core/execution-runtimes/resourceTypes.types';

function resourceTypeExample() {
	const config = {
		schemaVersion: 1,
		cpuReservePercent: 20,
		memoryReservePercent: 25,
		minMemoryReserveMiB: 2048,
		pollMs: 1000,
		staleSampleMs: 5000
	} satisfies ResourceConfig;
	const request = {
		priority: 'agent-test',
		cpus: 2,
		memoryMiB: 4096,
		label: 'Focused verification'
	} satisfies ResourceRequest;
	const snapshot = {
		status: 'available',
		sampledAt: 1730000000000,
		logicalCores: 8,
		usableCores: 6,
		cpuUsedPercent: 25,
		cpuAvailableCores: 4.5,
		memoryTotalBytes: 17179869184,
		memoryAvailableBytes: 8589934592,
		memoryPressure: 'normal'
	} satisfies ResourceSnapshot;
	const job = {
		...request,
		id: '11111111-1111-4111-8111-111111111111',
		sequence: 1,
		ownerPid: 42,
		ownerStarted: '2026-11-16T10:00:00.000Z',
		state: 'queued',
		createdAt: 1730000000000,
		heartbeatAt: 1730000000000,
		notice: null
	} satisfies ResourceJob;
	const context = {
		id: 'fixture-context',
		env: { CI: 'true' },
		track: (_pid: number) => undefined
	} satisfies ResourceContext;
	return {
		input: {
			config,
			request,
			snapshot,
			job: { ...job, id: 'fixture-job' },
			context: { id: context.id, env: context.env }
		},
		output: {
			configVersion: config.schemaVersion,
			requestPriority: request.priority,
			snapshotStatus: snapshot.status,
			jobState: job.state,
			contextId: context.id
		}
	};
}

test('Resource type contracts preserve runtime-facing shapes', () => {
	const example = resourceTypeExample();
	expect(example.output).toEqual({
		configVersion: 1,
		requestPriority: 'agent-test',
		snapshotStatus: 'available',
		jobState: 'queued',
		contextId: 'fixture-context'
	});
	recordExampleCases(
		{
			unitId: 'function.execution-runtimes-resource-types-types',
			symbol: 'ResourceConfig',
			state: 'resource-type-contracts-preserve-runtime-facing-shapes',
			evidence: 'examples-cases',
			file: 'resource-type-contracts-preserve-runtime-facing-shapes.json'
		},
		[
			{
				name: 'resource runtime values satisfy their declared type contracts',
				input: example.input,
				output: example.output
			}
		]
	);
});
