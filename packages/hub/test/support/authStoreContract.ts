import { expect, test } from 'vitest';
import type {
	AuthStore,
	GithubGrantRecord,
	NativeExchangeRecord,
	SessionRecord
} from '../../src/models/HubAuthStore.types';

const actor = { id: 'google-1', email: 'ada@gmail.com', name: 'Ada', emailVerified: true as const };

export function sessionRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
	return {
		idHash: 'session-a',
		kind: 'browser',
		parentHash: null,
		actor,
		resource: 'projects',
		createdAt: 1000,
		expiresAt: 5000,
		revokedAt: null,
		...overrides
	};
}

export function exchangeRecord(
	overrides: Partial<NativeExchangeRecord> = {}
): NativeExchangeRecord {
	return {
		id: 'handoff-a',
		challenge: 'challenge-a',
		nonceHash: 'nonce-hash',
		codeHash: 'code-hash',
		resource: 'projects',
		audience: 'harness-desktop',
		action: 'native-session',
		environment: 'staging',
		origin: 'https://hub.test',
		status: 'pending',
		subject: null,
		parentHash: null,
		expiresAt: 5000,
		...overrides
	};
}

export const grantRecord: GithubGrantRecord = {
	actorId: actor.id,
	githubUserId: 501,
	login: 'ada-hub',
	tokenCipher: 'v1.iv.cipher',
	tokenExpiresAt: 4000,
	refreshCipher: null,
	refreshExpiresAt: null,
	createdAt: 1000,
	expiresAt: 9000
};

function oneTimeTests(name: string, create: () => Promise<AuthStore>): void {
	test(`${name}: a challenge is claimed once, even by concurrent callers`, async () => {
		const store = await create();
		const record = { idHash: 'c1', nonce: 'nonce', csrfHash: 'csrf', expiresAt: 5000 };
		await store.challenges.create(record);
		const claims = await Promise.all([1, 2, 3].map(() => store.challenges.claim('c1', 2000)));
		expect(claims.filter(Boolean)).toEqual([record]);
		expect(await store.challenges.claim('c1', 2000)).toBeNull();
	});

	test(`${name}: an expired or unknown one-time record cannot be claimed`, async () => {
		const store = await create();
		const state = { idHash: 's1', sessionHash: 'session-a', actorId: actor.id, grantGeneration: 4 };
		await store.githubStates.create({ ...state, verifierCipher: 'v1.iv.c', expiresAt: 5000 });
		expect(await store.githubStates.claim('s1', 5000)).toBeNull();
		expect(await store.githubStates.claim('other', 2000)).toBeNull();
		expect(await store.githubStates.claim('s1', 4999)).toMatchObject(state);
	});
}

function sessionTests(name: string, create: () => Promise<AuthStore>): void {
	test(`${name}: revoking a session revokes the native sessions it approved`, async () => {
		const store = await create();
		await store.sessions.create(sessionRecord());
		await store.sessions.create(
			sessionRecord({ idHash: 'native-a', kind: 'native', parentHash: 'session-a' })
		);
		await store.sessions.create(sessionRecord({ idHash: 'session-b' }));
		expect(await store.sessions.find('native-a')).toEqual(
			sessionRecord({ idHash: 'native-a', kind: 'native', parentHash: 'session-a' })
		);
		await store.sessions.revoke('session-a', 3000);
		expect((await store.sessions.find('session-a'))?.revokedAt).toBe(3000);
		expect((await store.sessions.find('native-a'))?.revokedAt).toBe(3000);
		expect((await store.sessions.find('session-b'))?.revokedAt).toBeNull();
		expect(await store.sessions.find('missing')).toBeNull();
	});
}

function exchangeTests(name: string, create: () => Promise<AuthStore>): void {
	const approval = { id: 'handoff-a', codeHash: 'code-hash', subject: actor.id, now: 2000 };

	test(`${name}: an exchange needs the matching code to be approved, once`, async () => {
		const store = await create();
		await store.exchanges.create(exchangeRecord());
		const wrong = { ...approval, codeHash: 'other', parentHash: 'session-a' };
		expect(await store.exchanges.approve(wrong)).toBe(false);
		expect(await store.exchanges.claim('handoff-a', 2000)).toBeNull();
		expect(await store.exchanges.approve({ ...approval, parentHash: 'session-a' })).toBe(true);
		expect(await store.exchanges.approve({ ...approval, parentHash: 'session-b' })).toBe(false);
		expect(await store.exchanges.find('handoff-a')).toMatchObject({
			status: 'approved',
			subject: actor.id,
			parentHash: 'session-a'
		});
	});

	test(`${name}: an approved exchange is consumed by exactly one caller`, async () => {
		const store = await create();
		await store.exchanges.create(exchangeRecord());
		await store.exchanges.approve({ ...approval, parentHash: 'session-a' });
		const claims = await Promise.all([1, 2, 3].map(() => store.exchanges.claim('handoff-a', 2000)));
		expect(claims.filter(Boolean)).toHaveLength(1);
		expect(claims.find(Boolean)).toMatchObject({ status: 'consumed', subject: actor.id });
		expect(await store.exchanges.claim('handoff-a', 2000)).toBeNull();
	});

	test(`${name}: an expired exchange can be neither approved nor claimed`, async () => {
		const store = await create();
		await store.exchanges.create(exchangeRecord());
		const late = { ...approval, parentHash: 'session-a', now: 5000 };
		expect(await store.exchanges.approve(late)).toBe(false);
		await store.exchanges.approve({ ...approval, parentHash: 'session-a' });
		expect(await store.exchanges.claim('handoff-a', 5000)).toBeNull();
	});
}

function purgeTests(name: string, create: () => Promise<AuthStore>): void {
	test(`${name}: purge removes expired and revoked rows and keeps live ones`, async () => {
		const store = await create();
		await store.sessions.create(sessionRecord());
		await store.sessions.create(sessionRecord({ idHash: 'old', expiresAt: 1500 }));
		await store.sessions.create(sessionRecord({ idHash: 'gone', revokedAt: 1200 }));
		await store.exchanges.create(exchangeRecord({ expiresAt: 1500 }));
		await store.grants.connect(0, { ...grantRecord, expiresAt: 1500 });
		await store.challenges.create({ idHash: 'c', nonce: 'n', csrfHash: 'h', expiresAt: 1500 });
		await store.purge(2000);
		expect(await store.sessions.find('session-a')).not.toBeNull();
		expect(await store.sessions.find('old')).toBeNull();
		expect(await store.sessions.find('gone')).toBeNull();
		expect(await store.exchanges.find('handoff-a')).toBeNull();
		expect(await store.grants.read(actor.id)).toMatchObject({ generation: 2, grant: null });
		expect(await store.challenges.claim('c', 1000)).toBeNull();
	});
}

/** One behaviour, two stores: the in-memory test store and the D1 adapter over real SQLite. */
export function authStoreContract(name: string, create: () => Promise<AuthStore>): void {
	oneTimeTests(name, create);
	sessionTests(name, create);
	exchangeTests(name, create);
	purgeTests(name, create);
}
