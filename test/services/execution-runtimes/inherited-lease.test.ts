import { rmSync } from 'node:fs';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { resourceRequestSchema } from '../../../src/core/execution-runtimes/resourceTypes';
import { inheritedLeaseContext } from '../../../src/services/execution-runtimes/resource-queue-service/inheritedLease';
import { ResourceQueueRepository } from '../../../src/services/execution-runtimes/resource-queue-service/ResourceQueueRepository';
import { ResourceQueueError } from '../../../src/services/execution-runtimes/ResourceQueueError';
import { job, resourceQueueFixture } from '../../support/resourceFixture';
import { createTempDirectory } from '../../support/temporary';
import type * as IdentityModule from '../../../src/services/agents-providers/agent-activity-service/ProcessIdentityAdapter';

/** A provider sandbox refuses `ps`, so the probe answers nothing; outside one it answers either way. */
const identity = vi.hoisted(() => ({ exists: undefined as boolean | undefined }));
vi.mock(
	'../../../src/services/agents-providers/agent-activity-service/ProcessIdentityAdapter',
	async (importOriginal) => {
		const actual = await importOriginal<typeof IdentityModule>();
		class ProcessIdentityAdapter extends actual.ProcessIdentityAdapter {
			override find() {
				return { exists: identity.exists, startedAt: identity.exists ? 'fixture start' : null };
			}
		}
		return { ...actual, ProcessIdentityAdapter };
	}
);

const cleanup: Array<() => void> = [];
let queue: ResourceQueueRepository;
beforeEach(async () => {
	const home = await createTempDirectory('inherited-lease-');
	queue = new ResourceQueueRepository(home);
	cleanup.push(() => {
		queue.close();
		rmSync(home, { recursive: true, force: true });
	});
	identity.exists = undefined;
});
afterEach(() => {
	for (const step of cleanup.splice(0).reverse()) step();
});

const request = resourceRequestSchema.parse({ cpus: 2, memoryMiB: 1024, label: 'Nested check' });
function parent(changes: Parameters<typeof job>[0] = {}) {
	const lease = job({ state: 'running', cpus: 4, memoryMiB: 4096, ...changes });
	queue.add(lease);
	return lease;
}

test('work without an inherited lease takes the normal queue path', () => {
	parent();
	expect(inheritedLeaseContext(request, {}, queue)).toBeUndefined();
});

test.each([true, false])(
	'work whose process probe answers (%s) takes the normal queue path',
	(exists) => {
		identity.exists = exists;
		const lease = parent();
		expect(
			inheritedLeaseContext(request, { HARNESS_RESOURCE_LEASE: lease.id }, queue)
		).toBeUndefined();
	}
);

test('sandboxed nested work runs under its running parent lease without tracking', () => {
	const lease = parent();
	const context = inheritedLeaseContext(
		request,
		{ HARNESS_RESOURCE_LEASE: lease.id, PATH: '/usr/bin:/bin' },
		queue
	);
	expect(context).toMatchObject({ id: lease.id, inherited: true });
	expect(context?.env).toMatchObject({
		HARNESS_RESOURCE_LEASE: lease.id,
		HARNESS_RESOURCE_CPUS: '2',
		HARNESS_RESOURCE_MEMORY_MIB: '1024',
		PATH: '/usr/bin:/bin'
	});
	context?.track(process.pid);
	expect(queue.all().map((entry) => [entry.id, entry.workerPid])).toEqual([[lease.id, undefined]]);
});

test('sandboxed work naming a missing or waiting parent lease is refused', () => {
	const waiting = parent({ state: 'queued' });
	for (const lease of [waiting.id, '00000000-0000-4000-8000-000000000000']) {
		const env = { HARNESS_RESOURCE_LEASE: lease };
		expect(() => inheritedLeaseContext(request, env, queue)).toThrow(ResourceQueueError);
		expect(() => inheritedLeaseContext(request, env, queue)).toThrow(
			'Invalid inherited resource lease'
		);
	}
});

test.each([
	['cpus', { cpus: 5 }],
	['memory', { memoryMiB: 8192 }]
])('sandboxed work asking for more %s than its parent is refused', (_name, larger) => {
	const lease = parent();
	const env = { HARNESS_RESOURCE_LEASE: lease.id };
	expect(() => inheritedLeaseContext({ ...request, ...larger }, env, queue)).toThrow(
		'Nested work exceeds its parent resource reservation'
	);
	expect(
		inheritedLeaseContext({ ...request, cpus: 4, memoryMiB: 4096 }, env, queue)?.inherited
	).toBe(true);
});

test('the queue service runs inherited work without enqueueing a job of its own', async () => {
	const { service } = resourceQueueFixture(cleanup);
	const lease = job({ state: 'running', cpus: 4, memoryMiB: 4096 });
	service.queue.add(lease);
	const observed = await service.run(
		request,
		async (context) => ({ context, jobs: service.queue.all().map((entry) => entry.id) }),
		{ env: { HARNESS_RESOURCE_LEASE: lease.id } }
	);
	expect(observed.context).toMatchObject({ id: lease.id, inherited: true });
	expect(observed.jobs).toEqual([lease.id]);
});
