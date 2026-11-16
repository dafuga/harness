import { afterEach, test, vi } from 'vitest';
import {
	CHALLENGE_TTL,
	LoginChallengeService
} from '../../src/services/accounts-access/LoginChallengeService';
import { AuthFailure } from '../../src/utils/accounts-access/authFail';
import { authFixture } from '../support/authFixture';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

// The contract's examples are base64url of the byte runs 0-31, 32-63 and 64-95: the runs issue
// draws for its cookie, nonce and CSRF value, in that order.
const cookie = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8';
const nonce = 'ICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pj8';
const csrf = 'QEFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaW1xdXl8';
// The contract's consume.csrf example. It equals the nonce, not the CSRF value issue returned.
const contractCsrf = nonce;
const notIssued = 'ZXhhbXBsZS1ub3QtaXNzdWVkLWNvb2tpZQ';
const refused = { name: 'AuthFailure', code: 'challenge-invalid', status: 401 };

afterEach(() => {
	vi.restoreAllMocks();
});

/** Serves the byte runs above to randomToken in order, so issue returns the documented values. */
function replayEntropy(): void {
	let next = 0;
	vi.spyOn(crypto, 'getRandomValues').mockImplementation(((array: Uint8Array) => {
		for (let index = 0; index < array.length; index++) array[index] = next++;
		return array;
	}) as typeof crypto.getRandomValues);
}

/** Makes one consume call; records its output, or the AuthFailure it threw. Other errors fail. */
async function attempt(
	service: LoginChallengeService,
	name: string,
	cookieValue: string | null,
	csrfValue: string
) {
	const input = { cookie: cookieValue, csrf: csrfValue };
	try {
		return { name, input, output: await service.consume(cookieValue, csrfValue) };
	} catch (error) {
		if (!(error instanceof AuthFailure)) throw error;
		return { name, input, error: { name: error.name, code: error.code, status: error.status } };
	}
}

function setup() {
	const fixture = authFixture();
	const { store, secrets, now } = fixture;
	return { fixture, service: new LoginChallengeService({ store: store.challenges, secrets, now }) };
}

test('constructs without touching the store or the hasher', () => {
	const fixture = authFixture();
	const { store, secrets, now } = fixture;
	const hash = vi.spyOn(secrets, 'hash');
	const service = new LoginChallengeService({ store: store.challenges, secrets, now });
	expect(service).toBeInstanceOf(LoginChallengeService);
	expect(hash).not.toHaveBeenCalled();
	expect(store.count()).toBe(0);
	recordExampleCases(
		{
			unitId: 'hub.service.login-challenge',
			symbol: 'LoginChallengeService',
			state: 'constructs-without-touching-the-store-or-the-hasher',
			evidence: 'examples-cases',
			file: 'constructs-without-touching-the-store-or-the-hasher.json'
		},
		[
			{
				name: 'retains its options and does no work before issue or consume',
				input: { now: now() },
				output: { hashCalls: hash.mock.calls.length, storedRows: store.count() }
			}
		]
	);
});

test('issues a cookie and challenge and stores only hashes', async () => {
	replayEntropy();
	const { fixture, service } = setup();
	const { store, secrets, now } = fixture;
	const issued = await service.issue();
	const rows: unknown = JSON.parse(store.dump());
	expect(issued).toEqual({ cookie, challenge: { nonce, csrf } });
	expect(rows).toEqual([
		{
			idHash: await secrets.hash('challenge', cookie),
			nonce,
			csrfHash: await secrets.hash('csrf', csrf),
			expiresAt: now() + CHALLENGE_TTL
		}
	]);
	expect(store.dump()).not.toContain(cookie);
	expect(store.dump()).not.toContain(csrf);
	recordExampleCases(
		{
			unitId: 'hub.service.login-challenge',
			symbol: 'issue',
			state: 'issues-a-cookie-and-challenge-and-stores-only-hashes',
			evidence: 'examples-cases',
			file: 'issues-a-cookie-and-challenge-and-stores-only-hashes.json'
		},
		[{ name: 'issues the example cookie and challenge', input: { now: now() }, output: issued }]
	);
});

test('consumes a challenge once and returns its nonce', async () => {
	replayEntropy();
	const { service } = setup();
	await service.issue();
	const first = await attempt(service, 'returns the nonce for the issued cookie', cookie, csrf);
	const replay = await attempt(service, 'refuses the same cookie again', cookie, csrf);
	expect(first.output).toBe(nonce);
	expect(replay.error).toEqual(refused);
	recordExampleCases(
		{
			unitId: 'hub.service.login-challenge',
			symbol: 'consume',
			state: 'consumes-a-challenge-once-and-returns-its-nonce',
			evidence: 'examples-cases',
			file: 'consumes-a-challenge-once-and-returns-its-nonce.json'
		},
		[first, replay]
	);
});

test('refuses a null or unknown cookie and keeps the challenge', async () => {
	replayEntropy();
	const { service } = setup();
	await service.issue();
	const missing = await attempt(service, 'refuses a null cookie', null, csrf);
	const unissued = await attempt(service, 'refuses a cookie never issued', notIssued, csrf);
	const kept = await attempt(service, 'still consumes the issued challenge', cookie, csrf);
	expect(missing.error).toEqual(refused);
	expect(unissued.error).toEqual(refused);
	expect(kept.output).toBe(nonce);
	recordExampleCases(
		{
			unitId: 'hub.service.login-challenge',
			symbol: 'consume',
			state: 'refuses-a-null-or-unknown-cookie-and-keeps-the-challenge',
			evidence: 'examples-cases',
			file: 'refuses-a-null-or-unknown-cookie-and-keeps-the-challenge.json'
		},
		[missing, unissued, kept]
	);
});

test('refuses a wrong CSRF value and spends the challenge', async () => {
	replayEntropy();
	const { fixture, service } = setup();
	await service.issue();
	const wrong = await attempt(service, 'refuses an unissued CSRF value', cookie, contractCsrf);
	const right = await attempt(service, 'refuses the issued CSRF value once spent', cookie, csrf);
	expect(wrong.error).toEqual(refused);
	expect(right.error).toEqual(refused);
	expect(fixture.store.count()).toBe(0);
	recordExampleCases(
		{
			unitId: 'hub.service.login-challenge',
			symbol: 'consume',
			state: 'refuses-a-wrong-csrf-value-and-spends-the-challenge',
			evidence: 'examples-cases',
			file: 'refuses-a-wrong-csrf-value-and-spends-the-challenge.json'
		},
		[wrong, right]
	);
});

test('refuses a challenge once its five-minute expiry passes', async () => {
	replayEntropy();
	const { fixture, service } = setup();
	await service.issue();
	fixture.advance(CHALLENGE_TTL - 1);
	const beforeExpiry = await attempt(service, 'one millisecond before expiry', cookie, csrf);
	const later = await service.issue();
	fixture.advance(CHALLENGE_TTL);
	const { csrf: lateCsrf } = later.challenge;
	const atExpiry = await attempt(service, 'refuses the second at expiry', later.cookie, lateCsrf);
	expect(CHALLENGE_TTL).toBe(300000);
	expect(beforeExpiry.output).toBe(nonce);
	expect(atExpiry.error).toEqual(refused);
	recordExampleCases(
		{
			unitId: 'hub.service.login-challenge',
			symbol: 'consume',
			state: 'refuses-a-challenge-once-its-five-minute-expiry-passes',
			evidence: 'examples-cases',
			file: 'refuses-a-challenge-once-its-five-minute-expiry-passes.json'
		},
		[beforeExpiry, atExpiry]
	);
});
