import type * as ChildProcess from 'node:child_process';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';

const spawned = vi.hoisted(() => ({ count: 0 }));
vi.mock('node:child_process', async (original) => {
	const real = await original<typeof ChildProcess>();
	return {
		...real,
		execFileSync: ((...args: Parameters<typeof real.execFileSync>) => {
			spawned.count += 1;
			return real.execFileSync(...args);
		}) as typeof real.execFileSync
	};
});

let root: string;
beforeAll(async () => {
	root = await mkdtemp(join(tmpdir(), 'harness-same-site-'));
	await mkdir(join(root, 'site'), { recursive: true });
	await mkdir(join(root, 'other'), { recursive: true });
});
afterAll(() => rm(root, { recursive: true, force: true }));

test('a site outside Git is decided once, not once for every recorded event', async () => {
	const { sameSite } = await import('../../src/utils/repositoryIdentity');
	const [site, other] = [join(root, 'site'), join(root, 'other')];
	// As the analytics filter does for a project kept outside a repository.
	const own = Array.from({ length: 500 }, () => sameSite(site, site));
	const foreign = Array.from({ length: 500 }, () => sameSite(site, other));
	expect([own.every(Boolean), foreign.some(Boolean)]).toEqual([true, false]);
	expect(spawned.count).toBeLessThan(10);
});
