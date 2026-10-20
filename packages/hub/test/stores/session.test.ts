import { expect, test, vi } from 'vitest';
import { createSessionStore } from '../../src/lib/stores/session.svelte';
import type { BrowserAuth } from '../../src/utils/browserAuth';

const ada = {
	id: 'google:1',
	email: 'ada@example.invalid',
	name: 'Ada',
	emailVerified: true as const
};

test('a person is signed in only after the server says so', async () => {
	let actor: typeof ada | null = null;
	const auth = {
		status: vi.fn(async () => ({ actor, configured: true, clientId: 'client-1' })),
		challenge: vi.fn(async () => ({ nonce: 'n', csrf: 'c' })),
		google: vi.fn(async () => {
			actor = ada;
		}),
		logout: vi.fn(async () => {
			actor = null;
		})
	};
	const session = createSessionStore(auth as unknown as BrowserAuth);
	expect(session.status).toBeNull();
	await session.refresh();
	expect(session.actor).toBeNull();
	await session.signIn('credential', 'c');
	expect(auth.google).toHaveBeenCalledWith('credential', 'c');
	expect(session.actor).toEqual(ada);
	await session.signOut();
	expect(auth.logout).toHaveBeenCalledTimes(1);
	expect(session.actor).toBeNull();
});

test('a refused credential leaves nobody signed in and says why', async () => {
	const auth = {
		status: vi.fn(async () => ({ actor: null, configured: true, clientId: 'client-1' })),
		google: vi.fn(async () => {
			throw new Error('This Google account could not be verified.');
		})
	};
	const session = createSessionStore(auth as unknown as BrowserAuth);
	await session.signIn('bad', 'c');
	expect(session.actor).toBeNull();
	expect(session.error).toMatch(/could not be verified/);
	expect(session.busy).toBe(false);
});

test('a status that cannot be read is an error, not a signed-out or configured state', async () => {
	const auth = {
		status: vi.fn(async () => {
			throw new Error('The server could not be reached.');
		})
	};
	const session = createSessionStore(auth as unknown as BrowserAuth);
	await session.refresh();
	expect(session.status).toBeNull();
	expect(session.error).toMatch(/could not be reached/);
});

test('a late status from the previous Google account cannot replace the latest identity', async () => {
	let older!: (value: { actor: typeof ada; configured: boolean; clientId: string }) => void;
	const before = new Promise<{ actor: typeof ada; configured: boolean; clientId: string }>(
		(resolve) => {
			older = resolve;
		}
	);
	const ben = { ...ada, id: 'google:ben', name: 'Ben Example', email: 'ben@example.invalid' };
	let calls = 0;
	const auth = {
		status: () =>
			++calls === 1
				? before
				: Promise.resolve({ actor: ben, configured: true, clientId: 'client-1' })
	};
	const session = createSessionStore(auth as unknown as BrowserAuth);
	const first = session.refresh();
	const second = session.refresh();
	older({ actor: ada, configured: true, clientId: 'client-1' });
	await Promise.all([first, second]);
	expect(session.actor, 'latest Google account wins over stale status').toEqual(ben);
});
