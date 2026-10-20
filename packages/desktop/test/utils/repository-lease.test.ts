import { expect } from '../../../../test/verificationExpect';
import { afterEach, test, vi } from 'vitest';
import type * as ChildProcesses from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { repositoryLease, type RepositoryLease } from '../../src/utils/repositoryLease';

const spawned = vi.hoisted(() => [] as ChildProcess[]);
vi.mock('node:child_process', async (original) => {
	const actual = await original<typeof ChildProcesses>();
	return {
		...actual,
		spawn: (...args: Parameters<typeof actual.spawn>) => {
			const child = actual.spawn(...args);
			spawned.push(child);
			return child;
		}
	};
});
const roots: string[] = [],
	releases: RepositoryLease[] = [];
function root() {
	const value = join(tmpdir(), `harness-lease-test-${randomUUID()}`);
	roots.push(value);
	return value;
}
async function acquire(value: string) {
	const lease = await repositoryLease(value);
	expect(lease).not.toBeNull();
	releases.push(lease!);
	return lease!;
}
async function release(lease: RepositoryLease) {
	await lease();
	releases.splice(releases.indexOf(lease), 1);
}
afterEach(async () => {
	for (const lease of [...releases]) await release(lease);
	for (const value of roots.splice(0)) {
		const file = join(
			tmpdir(),
			`harness-runs-${process.getuid?.() ?? 'owner'}`,
			createHash('sha256').update(value).digest('hex')
		);
		await rm(file, { force: true });
		await rm(file + '.owner', { force: true });
	}
	spawned.length = 0;
});

test('a repository lease rejects contention and admits a new owner after release', async () => {
	const value = root(),
		first = await acquire(value);
	expect(first.signal.aborted).toBe(false);
	expect(await repositoryLease(value)).toBeNull();
	await release(first);
	const next = await acquire(value);
	expect(next.signal.aborted).toBe(false);
});

test('helper death aborts the lease but its parent fence holds until explicit release', async () => {
	const value = root(),
		first = await acquire(value),
		helper = spawned[0];
	const aborted = new Promise<void>((resolve) =>
		first.signal.addEventListener('abort', () => resolve(), { once: true })
	);
	expect(helper.kill('SIGKILL')).toBe(true);
	await aborted;
	expect(first.signal.aborted).toBe(true);
	expect(await repositoryLease(value)).toBeNull();
	await release(first);
	const next = await acquire(value);
	expect(next.signal.aborted).toBe(false);
});
