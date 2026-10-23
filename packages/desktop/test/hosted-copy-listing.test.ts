import type { Fixture } from './hosted-copy-listing.test.types';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../test/verificationExpect';
import { RemoteHttpProjectAdapter } from '../src/adapters/remote-http-project-adapter/RemoteHttpProjectAdapter';
import { RemoteProjectionService } from '../src/services/RemoteProjectionService';
import { analytics, former } from './catalog-listing-manifests';
import { remoteCacheFixture } from './remote-cache-fixture';
const tip = { projectId: 'p', branch: 'main', commit: null };
const pinned = { projectId: 'p', branch: 'main', commit: 'a'.repeat(40) };
const entity = { projectId: 'p', entityId: 'entity', commit: 'a'.repeat(40) };
const away = 'Hosted request failed or access was refused.';
const loader = {
	id: analytics,
	category: 'pages',
	kind: 'page',
	title: '/analytics',
	summary: former
};
const copies = async (f: Fixture) => (await readdir(join(f.root, 'cache')).catch(() => [])).length;

/**
 * Keeps a snapshot that lists a route loader where the build before this rule kept the snapshot
 * of the tip: under the address it was read at, in the same real cache. The hub of `reached`
 * says what a snapshot is; nothing of this build has read the project of `f`.
 */
async function keptEarlier(f: Fixture, reached: Fixture) {
	const live = await reached.adapter.snapshot(tip);
	const identity = live.cache!.identity;
	const address = new RemoteProjectionService(null as never, f.options).path('p', 'snapshot', tip);
	const snapshot = {
		project: live.project,
		revision: live.revision,
		entities: [loader],
		branches: [],
		commits: [],
		cache: { identity, status: 'fresh', publication: 'remote' }
	};
	await f.cache.remember(
		JSON.stringify([f.options.origin, 'alice', 'p', address]),
		identity,
		snapshot
	);
}

/** What the page is given for the tip: the identities listed, or why there is nothing to show. */
const shown = (adapter: RemoteHttpProjectAdapter) =>
	adapter.snapshot(tip).then(
		(snapshot) => snapshot.entities.map((item) => item.id).join(),
		(error: Error) => error.message
	);

test('a snapshot kept before the catalog left route loaders out is not shown while the hub is away', async () => {
	const [f, reached] = [await remoteCacheFixture(), await remoteCacheFixture()];
	try {
		await keptEarlier(f, reached);
		await f.close();
		expect(await shown(new RemoteHttpProjectAdapter(f.options))).toBe(away);
	} finally {
		await Promise.all([f.cleanup(), reached.cleanup()]);
	}
});

test('a snapshot this build kept is shown while the hub is away, at the tip and at a pinned commit', async () => {
	const f = await remoteCacheFixture();
	try {
		await f.adapter.snapshot(tip);
		await f.adapter.snapshot(pinned);
		await f.close();
		const restarted = new RemoteHttpProjectAdapter(f.options);
		for (const view of [tip, pinned]) {
			const snapshot = await restarted.snapshot(view);
			expect(snapshot.cache).toMatchObject({ status: 'offline', readOnly: true });
			expect([snapshot.revision.commit, snapshot.writable]).toEqual(['a'.repeat(40), false]);
		}
	} finally {
		await f.cleanup();
	}
});

test('what else was kept is still shown while the hub is away', async () => {
	const [f, reached] = [await remoteCacheFixture(), await remoteCacheFixture()];
	try {
		await f.adapter.entity(entity);
		await keptEarlier(f, reached);
		await f.close();
		const restarted = new RemoteHttpProjectAdapter(f.options);
		expect(await shown(restarted)).toBe(away);
		expect((await restarted.entity(entity)).title).toBe('first');
	} finally {
		await Promise.all([f.cleanup(), reached.cleanup()]);
	}
});

test('an earlier copy leaves with a denial like every other copy', async () => {
	const [f, reached] = [await remoteCacheFixture(), await remoteCacheFixture()];
	try {
		await f.adapter.entity(entity);
		await keptEarlier(f, reached);
		expect(await copies(f)).toBeGreaterThan(2);
		f.state.status = 403;
		await expect(f.adapter.snapshot(tip)).rejects.toThrow(away);
		expect(await copies(f)).toBe(0);
	} finally {
		await Promise.all([f.cleanup(), reached.cleanup()]);
	}
});
