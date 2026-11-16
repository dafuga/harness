import { test, vi } from 'vitest';
import { createSessionStore } from '../../src/lib/stores/projects-sessions/session.svelte';
import type { BrowserAuth } from '../../src/utils/accounts-access/browserAuth.types';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

const ada = {
	id: 'google:1',
	email: 'ada@example.invalid',
	name: 'Ada',
	emailVerified: true as const
};
const configured = { configured: true, clientId: 'client-1' };

function authOf(methods: Record<string, unknown>): BrowserAuth {
	return methods as unknown as BrowserAuth;
}

function shown(session: ReturnType<typeof createSessionStore>) {
	return { status: session.status, error: session.error, busy: session.busy };
}

/** A fake server whose status follows the sign-ins and sign-outs the store asks for. */
function serverWithChanges() {
	const server: { actor: typeof ada | null } = { actor: null };
	const status = vi.fn(async () => ({ actor: server.actor, ...configured }));
	const google = vi.fn(async () => {
		server.actor = ada;
		return { actor: ada };
	});
	const logout = vi.fn(async () => {
		server.actor = null;
		return { ok: true };
	});
	const emailVerify = vi.fn(async (code: string) => {
		if (code !== '246810') throw new Error('That code is not right or has expired.');
		server.actor = ada;
		return { actor: ada };
	});
	return { auth: authOf({ status, google, logout, emailVerify }), google, logout };
}

test('Starts with no status, an empty error and not busy', () => {
	const auth = authOf({ status: vi.fn() });
	const first = createSessionStore(auth);
	const second = createSessionStore(auth);
	const output = shown(first);
	expect(output).toEqual({ status: null, error: '', busy: false });
	expect(second).not.toBe(first);
	expect(shown(second)).toEqual(output);
	recordExampleCases(
		{
			unitId: 'hub.store.session',
			symbol: 'createSessionStore',
			state: 'starts-with-no-status-an-empty-error-and-not-busy',
			evidence: 'examples-cases',
			file: 'starts-with-no-status-an-empty-error-and-not-busy.json'
		},
		[
			{ name: 'new store from a browser auth client', input: { auth: 'status' }, output },
			{
				name: 'second store from the same client',
				input: { auth: 'status' },
				output: shown(second)
			}
		]
	);
});

test('Refresh shows the status the server returns', async () => {
	let actor: typeof ada | null = ada;
	const session = createSessionStore(
		authOf({ status: vi.fn(async () => ({ actor, ...configured })) })
	);
	await session.refresh();
	expect(session.actor).toEqual(ada);
	const first = shown(session);
	actor = null;
	await session.refresh();
	expect(session.actor).toBeNull();
	expect(session.error).toBe('');
	recordExampleCases(
		{
			unitId: 'hub.store.session',
			symbol: 'refresh',
			state: 'refresh-shows-the-status-the-server-returns',
			evidence: 'examples-cases',
			file: 'refresh-shows-the-status-the-server-returns.json'
		},
		[
			{ name: 'server answers with Ada signed in', input: { actor: ada }, output: first },
			{
				name: 'server answers with nobody signed in',
				input: { actor: null },
				output: shown(session)
			}
		]
	);
});

test('An unreadable status is an error and clears the status', async () => {
	let reachable = true;
	const status = vi.fn(async () => {
		if (!reachable) throw new Error('The server could not be reached.');
		return { actor: ada, ...configured };
	});
	const session = createSessionStore(authOf({ status }));
	await session.refresh();
	const readable = shown(session);
	reachable = false;
	await session.refresh();
	expect(session.status).toBeNull();
	expect(session.error).toContain('could not be reached');
	recordExampleCases(
		{
			unitId: 'hub.store.session',
			symbol: 'refresh',
			state: 'an-unreadable-status-is-an-error-and-clears-the-status',
			evidence: 'examples-cases',
			file: 'an-unreadable-status-is-an-error-and-clears-the-status.json'
		},
		[
			{ name: 'server is reachable', input: { reachable: true }, output: readable },
			{ name: 'server cannot be reached', input: { reachable: false }, output: shown(session) }
		]
	);
});

test('Check keeps the shown status when the answer repeats', async () => {
	let actor: typeof ada | null = ada;
	const session = createSessionStore(
		authOf({ status: vi.fn(async () => ({ actor, ...configured })) })
	);
	await session.refresh();
	const shownBefore = session.status;
	const before = shown(session);
	await session.check();
	const repeatedKept = session.status === shownBefore;
	expect(repeatedKept).toBe(true);
	actor = null;
	await session.check();
	const changedKept = session.status === shownBefore;
	expect(changedKept).toBe(false);
	expect(session.actor).toBeNull();
	recordExampleCases(
		{
			unitId: 'hub.store.session',
			symbol: 'check',
			state: 'check-keeps-the-shown-status-when-the-answer-repeats',
			evidence: 'examples-cases',
			file: 'check-keeps-the-shown-status-when-the-answer-repeats.json'
		},
		[
			{
				name: 'server repeats the signed-in answer',
				input: { actor: ada },
				output: { ...before, keptShownObject: repeatedKept }
			},
			{
				name: 'server answers with nobody signed in',
				input: { actor: null },
				output: { ...shown(session), keptShownObject: changedKept }
			}
		]
	);
});

test('Challenge passes the server answer or error through', async () => {
	const answer = { nonce: 'nonce-example-1', csrf: 'csrf-example-1' };
	const session = createSessionStore(authOf({ challenge: vi.fn(async () => answer) }));
	const returned = await session.challenge();
	expect(returned).toEqual(answer);
	const failure = new Error('The sign-in challenge could not be created.');
	const failing = createSessionStore(authOf({ challenge: vi.fn(() => Promise.reject(failure)) }));
	const rejected = await failing.challenge().catch((cause: unknown) => cause);
	expect(rejected).toBe(failure);
	recordExampleCases(
		{
			unitId: 'hub.store.session',
			symbol: 'challenge',
			state: 'challenge-passes-the-server-answer-or-error-through',
			evidence: 'examples-cases',
			file: 'challenge-passes-the-server-answer-or-error-through.json'
		},
		[
			{ name: 'server issues a nonce and csrf', input: { answer: 'issued' }, output: returned },
			{ name: 'server refuses the challenge', input: { answer: 'refused' }, error: failure.message }
		]
	);
});

test('Changes show only the status the server reads back', async () => {
	const { auth, google, logout } = serverWithChanges();
	const session = createSessionStore(auth);
	await session.signIn('credential-example', 'csrf-example');
	expect(google.mock.calls).toEqual([['credential-example', 'csrf-example']]);
	expect(session.actor).toEqual(ada);
	const signedIn = shown(session);
	await session.signOut();
	expect(logout).toHaveBeenCalledTimes(1);
	expect(session.actor).toBeNull();
	const signedOut = shown(session);
	const refused = await session.verifyEmail('000000');
	expect(refused).toBe(false);
	expect(session.error).toContain('not right');
	const refusedOutput = { ...shown(session), returned: refused };
	const accepted = await session.verifyEmail('246810');
	expect(accepted).toBe(true);
	expect(session.error).toBe('');
	expect(session.busy).toBe(false);
	recordExampleCases(
		{
			unitId: 'hub.store.session',
			symbol: 'signIn',
			state: 'changes-show-only-the-status-the-server-reads-back',
			evidence: 'examples-cases',
			file: 'changes-show-only-the-status-the-server-reads-back.json'
		},
		[
			{ name: 'sign-in with a Google credential', input: { call: 'signIn' }, output: signedIn },
			{ name: 'sign-out', input: { call: 'signOut' }, output: signedOut },
			{ name: 'email code the server refuses', input: { code: '000000' }, output: refusedOutput },
			{
				name: 'email code the server accepts',
				input: { code: '246810' },
				output: { ...shown(session), returned: accepted }
			}
		]
	);
});
