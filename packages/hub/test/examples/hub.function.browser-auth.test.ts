import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { browserAuth } from '../../src/utils/accounts-access/browserAuth';
import type {
	LoginChallenge,
	NativeRequest,
	BrowserAuth
} from '../../src/utils/accounts-access/browserAuth.types';

type Api = Parameters<typeof browserAuth>[0];
interface Call {
	method: string;
	path: string;
	body?: unknown;
}

const status = { actor: null, configured: true, clientId: 'fixture-client-id' };
const challenge: LoginChallenge = { nonce: 'fixture-nonce-7', csrf: 'fixture-csrf-7' };
const signedIn = { actor: { id: 'fixture-user-1' } };
const pendingRequest: NativeRequest = { status: 'pending', resource: 'fixture-desktop-scope' };
const meta = (symbol: string, state: string) => ({
	unitId: 'hub.function.browser-auth',
	symbol,
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

/** A fake BrowserApi that records each request and answers from `replies`; an Error reply rejects. */
function fakeApi(replies: Record<string, unknown>) {
	const calls: Call[] = [];
	const answer = (method: string, path: string, body?: unknown): Promise<unknown> => {
		calls.push({ method, path, body });
		const reply = replies[path];
		return reply instanceof Error ? Promise.reject(reply) : Promise.resolve(reply);
	};
	const api = {
		media: () => Promise.reject(new Error('media is not used by sign-in')),
		bytes: () => Promise.reject(new Error('bytes is not used by sign-in')),
		get: (path: string) => answer('GET', path),
		send: (method: 'POST' | 'DELETE', path: string, body?: unknown) => answer(method, path, body)
	} as unknown as Api;
	const auth: BrowserAuth = browserAuth(api);
	return { auth, calls };
}

test('Status and challenge calls read the auth endpoints', async () => {
	const { auth, calls } = fakeApi({
		'/api/auth/status': status,
		'/api/auth/challenge': challenge
	});
	const statusResult = await auth.status();
	const challengeResult = await auth.challenge();
	expect(statusResult).toEqual(status);
	expect(challengeResult).toEqual(challenge);
	expect(calls).toEqual([
		{ method: 'GET', path: '/api/auth/status' },
		{ method: 'POST', path: '/api/auth/challenge' }
	]);
	recordExampleCases(meta('browserAuth', 'status-and-challenge-calls-read-the-auth-endpoints'), [
		{
			name: 'page reads the configured signed-out status',
			input: { path: '/api/auth/status' },
			output: statusResult
		},
		{
			name: 'page requests a fresh login challenge',
			input: { path: '/api/auth/challenge' },
			output: challengeResult
		}
	]);
});

test('Google and email sign-in send only the supplied fields', async () => {
	const { auth, calls } = fakeApi({
		'/api/auth/google': signedIn,
		'/api/auth/email/start': { actor: null },
		'/api/auth/email/verify': signedIn,
		'/api/auth/logout': { ok: true }
	});
	const google = await auth.google('fixture-credential.jwt', challenge.csrf);
	const started = await auth.emailStart();
	const verified = await auth.emailVerify('123456');
	const loggedOut = await auth.logout();
	expect(calls).toEqual([
		{
			method: 'POST',
			path: '/api/auth/google',
			body: { credential: 'fixture-credential.jwt', csrf: 'fixture-csrf-7' }
		},
		{ method: 'POST', path: '/api/auth/email/start' },
		{ method: 'POST', path: '/api/auth/email/verify', body: { code: '123456' } },
		{ method: 'POST', path: '/api/auth/logout' }
	]);
	expect([google, started, verified, loggedOut]).toEqual([
		signedIn,
		{ actor: null },
		signedIn,
		{ ok: true }
	]);
	recordExampleCases(
		meta('browserAuth', 'google-and-email-sign-in-send-only-the-supplied-fields'),
		[
			{
				name: 'Google credential with its csrf is posted',
				input: { credential: 'fixture-credential.jwt' },
				output: google
			},
			{ name: 'email code is requested for the pending address', input: {}, output: started },
			{ name: 'typed email code is verified', input: { code: '123456' }, output: verified },
			{ name: 'session is signed out', input: {}, output: loggedOut }
		]
	);
});

test('Native handoff poll and approve send the handoff fields', async () => {
	const { auth, calls } = fakeApi({
		'/api/auth/native/poll': pendingRequest,
		'/api/auth/native/approve': { approved: true, resource: 'fixture-desktop-scope' }
	});
	const polled = await auth.nativeRequest('handoff-fixture-1');
	const approved = await auth.nativeApprove('handoff-fixture-1', 'ABCD-1234');
	expect(calls).toEqual([
		{ method: 'POST', path: '/api/auth/native/poll', body: { handoffId: 'handoff-fixture-1' } },
		{
			method: 'POST',
			path: '/api/auth/native/approve',
			body: { handoffId: 'handoff-fixture-1', userCode: 'ABCD-1234' }
		}
	]);
	expect(polled).toEqual(pendingRequest);
	expect(approved).toEqual({ approved: true, resource: 'fixture-desktop-scope' });
	recordExampleCases(
		meta('browserAuth', 'native-handoff-poll-and-approve-send-the-handoff-fields'),
		[
			{
				name: 'desktop app polls its pending handoff',
				input: { handoffId: 'handoff-fixture-1' },
				output: polled
			},
			{
				name: 'signed-in browser approves the handoff with the typed code',
				input: { handoffId: 'handoff-fixture-1', userCode: 'ABCD-1234' },
				output: approved
			}
		]
	);
});

test('Client failures reach the caller without translation', async () => {
	const failure = new Error('fixture client unavailable');
	const { auth } = fakeApi({ '/api/auth/status': failure });
	await expect(auth.status()).rejects.toBe(failure);
	recordExampleCases(meta('browserAuth', 'client-failures-reach-the-caller-without-translation'), [
		{
			name: 'client rejects the status read and the error is passed through',
			input: { path: '/api/auth/status' },
			error: 'fixture client unavailable'
		}
	]);
});
