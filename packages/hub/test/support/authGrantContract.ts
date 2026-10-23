import type { Create } from './authGrantContract.types';
import { expect, test } from 'vitest';
import { grantRecord as grant } from './authStoreContract';

const actor = grant.actorId;
const empty = { grant: null, refreshingUntil: null };
const lease = { actorId: actor, generation: 1, now: 2000, until: 2030 };

function connectTests(name: string, create: Create): void {
	test(`${name}: a connection is published only against the generation it observed`, async () => {
		const store = await create();
		expect(await store.grants.read(actor)).toEqual({ generation: 0, ...empty });
		expect(await store.grants.connect(3, grant)).toBe(false);
		const racing = [
			{ ...grant, login: 'first' },
			{ ...grant, login: 'second' }
		];
		const published = await Promise.all(racing.map((record) => store.grants.connect(0, record)));
		expect(published).toEqual([true, false]);
		expect(await store.grants.read(actor)).toEqual({
			generation: 1,
			grant: { ...grant, login: 'first' },
			refreshingUntil: null
		});
		expect(await store.grants.connect(1, grant)).toBe(true);
		expect((await store.grants.read(actor)).generation).toBe(2);
	});

	test(`${name}: a revocation erases the tokens, stays as a tombstone and outdates earlier writers`, async () => {
		const store = await create();
		await store.grants.revoke(actor, 2000);
		expect(await store.grants.read(actor)).toEqual({ generation: 1, ...empty });
		expect(await store.grants.connect(0, grant)).toBe(false);
		expect(await store.grants.connect(1, grant)).toBe(true);
		await store.grants.revoke(actor, 2500);
		expect(await store.grants.read(actor)).toEqual({ generation: 3, ...empty });
		expect(await store.grants.connect(2, grant)).toBe(false);
		expect(await store.grants.lease({ ...lease, generation: 3 })).toBe(false);
	});
}

function leaseTests(name: string, create: Create): void {
	test(`${name}: one caller at a time holds the rotation lease`, async () => {
		const store = await create();
		await store.grants.connect(0, grant);
		const claims = await Promise.all([1, 2, 3].map(() => store.grants.lease(lease)));
		expect(claims.filter(Boolean)).toHaveLength(1);
		expect(await store.grants.lease({ ...lease, now: 2029, until: 2059 })).toBe(false);
		expect(await store.grants.lease({ ...lease, generation: 2 })).toBe(false);
		expect(await store.grants.lease({ ...lease, now: 2030, until: 2060 })).toBe(true);
		expect((await store.grants.read(actor)).refreshingUntil).toBe(2060);
		expect(await store.grants.lease({ ...lease, now: 9000, until: 9030 })).toBe(false);
	});

	test(`${name}: only the holder of the lease stores a rotation, and the lifetime is kept`, async () => {
		const store = await create();
		await store.grants.connect(0, grant);
		const rotated = { ...grant, tokenCipher: 'v1.iv.rotated', createdAt: 7, expiresAt: 8 };
		expect(await store.grants.rotate(lease, rotated)).toBe(false);
		await store.grants.lease(lease);
		expect(await store.grants.rotate({ ...lease, until: 2031 }, rotated)).toBe(false);
		expect(await store.grants.rotate(lease, rotated)).toBe(true);
		expect(await store.grants.read(actor)).toEqual({
			generation: 1,
			grant: { ...grant, tokenCipher: 'v1.iv.rotated' },
			refreshingUntil: null
		});
		expect(await store.grants.rotate(lease, rotated)).toBe(false);
	});
}

function outcomeTests(name: string, create: Create): void {
	test(`${name}: a rotation loses to a revocation or a reconnection that came first`, async () => {
		for (const interrupt of ['revoke', 'connect'] as const) {
			const store = await create();
			await store.grants.connect(0, grant);
			await store.grants.lease(lease);
			if (interrupt === 'revoke') await store.grants.revoke(actor, 2010);
			else await store.grants.connect(1, { ...grant, login: 'newer' });
			expect(await store.grants.rotate(lease, grant)).toBe(false);
			expect(await store.grants.revokeLeased(lease, 2020)).toBe(false);
			const { generation, grant: current } = await store.grants.read(actor);
			expect(generation).toBe(2);
			expect(current?.login ?? null).toBe(interrupt === 'revoke' ? null : 'newer');
		}
	});

	test(`${name}: a refused rotation and an expiry leave tombstones, never a reused generation`, async () => {
		const store = await create();
		await store.grants.connect(0, grant);
		await store.grants.lease(lease);
		expect(await store.grants.revokeLeased(lease, 2020)).toBe(true);
		expect(await store.grants.read(actor)).toEqual({ generation: 2, ...empty });
		await store.grants.connect(2, { ...grant, expiresAt: 3000 });
		const { purge } = store;
		await purge(3000);
		expect(await store.grants.read(actor)).toEqual({ generation: 4, ...empty });
		await store.purge(99_999);
		expect((await store.grants.read(actor)).generation).toBe(4);
		expect(await store.grants.connect(0, grant)).toBe(false);
	});
}

/** The grant semantics both stores must share: compare-and-swap, lease and tombstone. */
export function grantStoreContract(name: string, create: Create): void {
	connectTests(name, create);
	leaseTests(name, create);
	outcomeTests(name, create);
}
