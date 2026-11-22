import type { Request, Queue } from './function.resource-context.test.types';
import { test } from 'vitest';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';
import { resourceContext } from '../../src/utils/execution-runtimes/resourceContext';

const leaseId = '3f9b2c1e-8a47-4d6e-9b15-0c7e2a4d8f61';
const absentPid = 2147483646;
const codingRequest: Request = {
	priority: 'coding',
	cpus: 4,
	memoryMiB: 4096,
	label: 'Managed work'
};

function fakeQueue(): { queue: Queue; patches: unknown[] } {
	const patches: unknown[] = [];
	const queue = {
		patch: (...args: unknown[]) => {
			patches.push(args);
		}
	} as unknown as Queue;
	return { queue, patches };
}

function meta(state: string) {
	return {
		unitId: 'function.resource-context',
		symbol: 'resourceContext',
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

test('Lease context env carries bounded resource settings', () => {
	const env = {
		PATH: '/usr/bin:/bin',
		HARNESS_RESOURCE_PRIORITY: 'environment',
		GOMAXPROCS: '2'
	};
	const { queue } = fakeQueue();
	const context = resourceContext(leaseId, codingRequest, env, queue);

	expect(context.id).toBe(leaseId);
	expect(context.env).toMatchObject({
		PATH: '/usr/bin:/bin',
		HARNESS_RESOURCE_LEASE: leaseId,
		HARNESS_RESOURCE_CPUS: '4',
		HARNESS_RESOURCE_MEMORY_MIB: '4096',
		HARNESS_RESOURCE_PRIORITY: 'coding',
		CARGO_BUILD_JOBS: '4',
		GOMAXPROCS: '2'
	});
	recordExampleCases(meta('lease-context-env-carries-bounded-resource-settings'), [
		{
			name: 'caller GOMAXPROCS below the lease CPUs is kept, other thread caps follow the lease',
			input: { id: leaseId, request: codingRequest, env },
			output: { id: context.id, env: context.env }
		}
	]);
});

test('Track skips a PID the system reports absent', () => {
	const { queue, patches } = fakeQueue();
	const context = resourceContext(leaseId, codingRequest, {}, queue);

	context.track(absentPid);

	expect(patches).toEqual([]);
	recordExampleCases(meta('track-skips-a-pid-the-system-reports-absent'), [
		{
			name: 'PID 2147483646 is reported absent, so the queue is not patched',
			input: { id: leaseId, pid: absentPid },
			output: { patches }
		}
	]);
});

test('Null request is rejected before a context is built', () => {
	const { queue } = fakeQueue();
	const build = () => resourceContext(leaseId, null as unknown as Request, {}, queue);

	expect(build).toThrow(TypeError);
	recordExampleCases(meta('null-request-is-rejected-before-a-context-is-built'), [
		{
			name: 'request is null',
			input: { id: leaseId, request: null },
			error: 'TypeError'
		}
	]);
});
