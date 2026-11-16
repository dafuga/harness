import { test } from 'vitest';
import { resourceRequest } from '../../src/utils/execution-runtimes/resourceRequest';
import type { ResourceSnapshot } from '../../src/core/execution-runtimes/resourceTypes';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';

const snapshot: ResourceSnapshot = {
	status: 'available',
	sampledAt: 1,
	logicalCores: 8,
	usableCores: 8,
	cpuUsedPercent: 0,
	cpuAvailableCores: 8,
	memoryTotalBytes: 16 * 1024 * 1024 * 1024,
	memoryAvailableBytes: 16 * 1024 * 1024 * 1024,
	memoryPressure: 'normal'
};

test('Resolves automatic, explicit, and inherited resource requests', async () => {
	await withTempDir('resource-request-', async (home) => {
		const service = {
			home,
			snapshot: async () => snapshot,
			queue: { all: () => [] }
		};
		const automatic = await resourceRequest(
			{ priority: 'coding', cpus: 'auto', memoryMib: 'auto', label: 'Managed work' },
			service,
			{}
		);
		const explicit = await resourceRequest(
			{ priority: 'agent-test', cpus: '2', memoryMib: '1280', label: 'Scoped verification' },
			service,
			{}
		);
		const inherited = await resourceRequest(
			{ cpus: 'auto', memoryMib: 'auto' },
			service,
			{
				HARNESS_RESOURCE_LEASE: '7a8e1a1b-91e6-427a-b4f0-41f321908271',
				HARNESS_RESOURCE_CPUS: '2',
				HARNESS_RESOURCE_MEMORY_MIB: '1280'
			}
		);
		expect([automatic, explicit, inherited]).toEqual([
			{ priority: 'coding', cpus: 7, memoryMiB: 3840, label: 'Managed work' },
			{ priority: 'agent-test', cpus: 2, memoryMiB: 1280, label: 'Scoped verification' },
			{ priority: 'coding', cpus: 2, memoryMiB: 1280, label: 'Managed work' }
		]);
		recordExampleCases(
			{
				unitId: 'function.resource-request',
				symbol: 'resourceRequest',
				state: 'resolves-automatic-explicit-and-inherited-resource-requests',
				evidence: 'examples-cases',
				file: 'resolves-automatic-explicit-and-inherited-resource-requests.json'
			},
			[
				{ name: 'sizes a top-level request from available resources', input: { cpus: 'auto', memoryMib: 'auto' }, output: automatic },
				{ name: 'converts explicit CLI strings', input: { cpus: '2', memoryMib: '1280' }, output: explicit },
				{ name: 'uses inherited lease reservations', input: { cpus: 'auto', memoryMib: 'auto' }, output: inherited }
			]
		);
	});
});
