import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { resourceRequest } from '../../src/utils/execution-runtimes/resourceRequest';
import { job, snapshot } from '../support/resourceFixture';
const homes: string[] = [];
afterEach(() => homes.splice(0).forEach((home) => rmSync(home, { recursive: true, force: true })));
function source(jobs = [job({ state: 'running', cpus: 6 })]) {
	const home = mkdtempSync(join(tmpdir(), 'resource-sizing-'));
	homes.push(home);
	return { home, snapshot: async () => snapshot(), queue: { all: () => jobs } };
}
const flags = { priority: 'agent-test', cpus: 'auto', memoryMib: 'auto' };
test('auto sizes workers against reserves and existing root reservations', async () => {
	expect(await resourceRequest(flags, source([]), {})).toMatchObject({ cpus: 9, memoryMiB: 4864 });
	const parent = job({ state: 'running', cpus: 6 });
	const nested = job({ parentId: parent.id, state: 'running', cpus: 6 });
	expect(await resourceRequest(flags, source([parent, nested]), {})).toMatchObject({
		cpus: 3,
		memoryMiB: 1792
	});
});
test('auto preserves the inherited budget and rejects malformed resource flags', async () => {
	expect(
		await resourceRequest(flags, source(), {
			HARNESS_RESOURCE_LEASE: 'parent',
			HARNESS_RESOURCE_CPUS: '2',
			HARNESS_RESOURCE_MEMORY_MIB: '1024'
		})
	).toMatchObject({ cpus: 2, memoryMiB: 1024 });
	await expect(resourceRequest({ ...flags, cpus: 'bad' }, source(), {})).rejects.toThrow();
});
test('single-core quota retains CPU reserve instead of requesting impossible full-core capacity', async () => {
	const single = source([]);
	single.snapshot = async () => snapshot({ usableCores: 1, logicalCores: 1, cpuAvailableCores: 1 });
	expect((await resourceRequest(flags, single, {})).cpus).toBeCloseTo(0.9);
});

test('unknown telemetry still creates a request that waits for a usable sample', async () => {
	const unknown = source([]);
	unknown.snapshot = async () => snapshot({ status: 'unavailable', usableCores: 0 });
	expect((await resourceRequest(flags, unknown, {})).cpus).toBe(1);
});
