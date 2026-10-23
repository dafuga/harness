import type { Create } from './authEmailContract.types';
import { expect, test } from 'vitest';
import type { AuthStore, EmailProofRecord } from '../../src/models/HubAuthStore.types';
const actor = {
	id: 'google-3',
	email: 'lin@example.org',
	name: 'Lin',
	emailVerified: true as const
};
const pending: EmailProofRecord = {
	idHash: 'proof-a',
	actor,
	codeHash: null,
	codeExpiresAt: null,
	attempts: 0,
	claimed: false,
	expiresAt: 5000
};
const issue = { idHash: 'proof-a', codeHash: 'code-1', codeExpiresAt: 6000, now: 2000 };
const guess = (codeHash: string, now = 2100) => ({ idHash: 'proof-a', codeHash, limit: 5, now });

function attemptTests(name: string, create: Create): void {
	test(`${name}: a proof has no code until one is issued, and a new code restarts the attempts`, async () => {
		const store = await create();
		await store.emailProofs.create(pending);
		expect(await store.emailProofs.find('proof-a')).toEqual(pending);
		expect(await store.emailProofs.attempt(guess('code-1'))).toBeNull();
		expect(await store.emailProofs.issue(issue)).toBe(true);
		expect(await store.emailProofs.attempt(guess('wrong'))).toMatchObject({
			attempts: 1,
			claimed: false
		});
		expect(await store.emailProofs.issue({ ...issue, codeHash: 'code-2', now: 2200 })).toBe(true);
		expect(await store.emailProofs.find('proof-a')).toMatchObject({
			codeHash: 'code-2',
			attempts: 0,
			expiresAt: 6000
		});
		expect(await store.emailProofs.issue({ ...issue, idHash: 'other' })).toBe(false);
		expect(await store.emailProofs.issue({ ...issue, now: 6000 })).toBe(false);
	});

	test(`${name}: parallel wrong guesses spend exactly the limit, then even the right code is refused`, async () => {
		const store = await create();
		await store.emailProofs.create(pending);
		await store.emailProofs.issue(issue);
		const guesses = Array.from({ length: 12 }, () => store.emailProofs.attempt(guess('wrong')));
		const counted = (await Promise.all(guesses)).filter((row) => row !== null);
		expect(counted.map((row) => row.attempts).sort()).toEqual([1, 2, 3, 4, 5]);
		expect(await store.emailProofs.attempt(guess('code-1'))).toBeNull();
		expect(await store.emailProofs.finish('proof-a')).toBe(false);
	});
}

function claimTests(name: string, create: Create): void {
	test(`${name}: the right code claims the proof for one caller, and it is finished once`, async () => {
		const store = await create();
		await store.emailProofs.create(pending);
		await store.emailProofs.issue(issue);
		expect(await store.emailProofs.finish('proof-a')).toBe(false);
		const claims = await Promise.all(
			[1, 2, 3, 4].map(() => store.emailProofs.attempt(guess('code-1')))
		);
		expect(claims.filter((row) => row?.claimed)).toHaveLength(1);
		expect(claims.filter((row) => row === null)).toHaveLength(3);
		expect(await store.emailProofs.issue({ ...issue, codeHash: 'code-2' })).toBe(false);
		const finished = await Promise.all([1, 2].map(() => store.emailProofs.finish('proof-a')));
		expect(finished).toEqual([true, false]);
		expect(await store.emailProofs.find('proof-a')).toBeNull();
	});

	test(`${name}: an expired code or a removed proof takes no attempt`, async () => {
		const store = await create();
		await store.emailProofs.create(pending);
		await store.emailProofs.issue(issue);
		expect(await store.emailProofs.attempt(guess('code-1', 6000))).toBeNull();
		expect(await store.emailProofs.attempt(guess('code-1'))).toMatchObject({ claimed: true });
		await store.emailProofs.remove('proof-a');
		expect(await store.emailProofs.finish('proof-a')).toBe(false);
	});
}

function ledgerTests(name: string, create: Create): void {
	const window = { key: 'actor:google-3', now: 100_000, day: 7, since: 40_000, cap: 3 };

	test(`${name}: a key sends once per interval and up to its cap per day`, async () => {
		const store = await create();
		const racing = await Promise.all([1, 2, 3].map(() => store.emailLedger.allow(window)));
		expect(racing.filter(Boolean)).toHaveLength(1);
		const later = (minutes: number) => {
			const now = window.now + minutes * 61_000;
			return store.emailLedger.allow({ ...window, now, since: now - 60_000 });
		};
		expect(await later(1)).toBe(true);
		expect(await later(2)).toBe(true);
		expect(await later(3)).toBe(false);
		expect(await store.emailLedger.allow({ ...window, key: 'email:other' })).toBe(true);
		const tomorrow = { ...window, day: 8, now: 90_000_000, since: 89_940_000 };
		expect(await store.emailLedger.allow(tomorrow)).toBe(true);
	});

	test(`${name}: a proven address is kept per subject and replaced by the next proof`, async () => {
		const store = await create();
		expect(await store.emailLedger.proven(actor.id)).toBeNull();
		const record = { actorId: actor.id, emailHash: 'hash-a', verifiedAt: 1000, expiresAt: 9000 };
		await store.emailLedger.prove(record);
		await store.emailLedger.prove({ ...record, emailHash: 'hash-b' });
		expect(await store.emailLedger.proven(actor.id)).toEqual({ ...record, emailHash: 'hash-b' });
		await store.emailProofs.create(pending);
		await store.purge(9000);
		expect(await store.emailLedger.proven(actor.id)).toBeNull();
		expect(await store.emailProofs.find('proof-a')).toBeNull();
	});
}

/** Email-proof semantics both stores must share: one-statement attempts, claims and send caps. */
export function emailStoreContract(name: string, create: Create): void {
	attemptTests(name, create);
	claimTests(name, create);
	ledgerTests(name, create);
}
