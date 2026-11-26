import type { Actor } from 'collaboration';
import { test } from 'vitest';
import { GRANT_TTL } from '../../src/lib/verification-evidence/server/auth/GithubGrantService';
import { GRACE_GITHUB } from '../support/githubFakeState';
import { holdGithub } from '../support/githubFixture';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import type { Observed } from './hub.service.github-grant.test.types';
import {
	fixture,
	attempt,
	mariaSession,
	refused,
	where,
	maria,
	connected,
	jun,
	none,
	unavailable,
	MARIA_GITHUB
} from './hub.service.github-grant.cases';

const EIGHT_HOURS = 28_800_000;
const UNKNOWN_STATE = 'k3Jx9QwVb2LzT7rNcE5hGyP0mD8sFaU1oRi6WtYvBnA';
const disconnected = { configured: true, connected: false, login: null };
/** GitHub tokens are random, so the evidence keeps only their prefix and length. */
const shape = (token: string) => ({ prefix: token.slice(0, 4), length: token.length });

test('Throws AuthFailure when the state is unknown', async () => {
	const observed: Observed = [];
	const hub = await fixture();
	const missing = { code: '7f3a9c2e1b8d4f60a5c7', state: UNKNOWN_STATE };
	expect(
		await attempt(
			observed,
			'a state that was never issued is refused',
			{ session: mariaSession, ...missing },
			() => hub.service.complete(mariaSession, missing)
		)
	).toEqual(refused);
	recordExampleCases(where('complete', 'throws-authfailure-when-the-state-is-unknown'), observed);
});

test('Reports connected only while a live grant exists', async () => {
	const observed: Observed = [];
	const hub = await fixture();
	const seen = async (name: string, who: Actor) => {
		const output = await hub.service.status(who);
		observed.push({ name, input: who, output });
		return output;
	};
	expect(await seen('Maria before she connects', maria)).toEqual(disconnected);
	await hub.connect(mariaSession);
	expect(await seen('Maria right after connecting', maria)).toEqual(connected);
	hub.advance(GRANT_TTL - 1);
	expect(await seen('one millisecond before the grant lifetime ends', maria)).toEqual(connected);
	hub.advance(1);
	expect(await seen('at the lifetime an expired grant is no grant', maria)).toEqual(disconnected);
	expect(await seen('Jun has never connected', jun)).toEqual(disconnected);
	recordExampleCases(where('status', 'reports-connected-only-while-a-live-grant-exists'), observed);
});

test('Erases the grant and leaves a tombstone', async () => {
	const observed: Observed = [];
	const ask = (name: string, input: Actor, run: () => Promise<unknown>) =>
		attempt(observed, name, input, run);
	const hub = await fixture();
	await hub.connect(mariaSession);
	expect(
		await ask('Maria disconnects her connected grant', maria, () => hub.service.disconnect(maria))
	).toEqual(none);
	expect(await hub.service.status(maria)).toEqual(disconnected);
	expect(await hub.store.grants.read(maria.id)).toEqual({
		generation: 2,
		grant: null,
		refreshingUntil: null
	});
	expect(
		await ask('Jun has no grant and still resolves', jun, () => hub.service.disconnect(jun))
	).toEqual(none);
	recordExampleCases(where('disconnect', 'erases-the-grant-and-leaves-a-tombstone'), observed);
});

test('Returns a live user token and rotates an expired one', async () => {
	const observed: Observed = [];
	const ask = (name: string, input: Actor, run: () => Promise<unknown>) =>
		attempt(observed, name, input, run);
	const hub = await fixture();
	await hub.connect(mariaSession);
	const stored = await hub.service.userToken(maria);
	expect(await hub.service.userToken(maria)).toBe(stored);
	observed.push({
		name: 'Maria: the stored token while it is fresh',
		input: maria,
		output: shape(stored)
	});
	hub.advance(EIGHT_HOURS);
	const rotated = await hub.service.userToken(maria);
	expect(rotated).not.toBe(stored);
	expect(await hub.service.userToken(maria)).toBe(rotated);
	observed.push({
		name: 'Maria: the expired token is rotated',
		input: maria,
		output: shape(rotated)
	});

	const contested = await fixture();
	await contested.connect(mariaSession);
	contested.advance(EIGHT_HOURS);
	const hold = holdGithub(contested.github, (call) =>
		call.body.includes('grant_type=refresh_token')
	);
	const holder = contested.service.userToken(maria);
	await hold.reached;
	expect(
		await ask('a second caller inside the 30 second lease', maria, () =>
			contested.service.userToken(maria)
		)
	).toEqual(unavailable);
	hold.release();
	observed.push({
		name: 'the caller holding the lease gets the rotated token',
		input: maria,
		output: shape(await holder)
	});
	contested.advance(EIGHT_HOURS);
	const again = holdGithub(contested.github, (call) =>
		call.body.includes('grant_type=refresh_token')
	);
	const inFlight = contested.service.userToken(maria);
	await again.reached;
	await contested.service.disconnect(maria);
	again.release();
	expect(
		await ask('a rotation in flight cannot write back after a disconnect', maria, () => inFlight)
	).toEqual(refused);

	const revoked = await fixture();
	await revoked.connect(mariaSession);
	revoked.github.revoke(MARIA_GITHUB);
	revoked.advance(EIGHT_HOURS);
	expect(
		await ask('GitHub refuses the refresh token', maria, () => revoked.service.userToken(maria))
	).toEqual(refused);
	expect(await revoked.service.status(maria)).toEqual(disconnected);

	const swapped = await fixture();
	await swapped.connect(mariaSession);
	for (const key of swapped.github.state.refreshTokens.keys())
		swapped.github.state.refreshTokens.set(key, GRACE_GITHUB);
	swapped.advance(EIGHT_HOURS);
	expect(
		await ask('GitHub answers the refresh for another user', maria, () =>
			swapped.service.userToken(maria)
		)
	).toEqual(refused);

	const down = await fixture();
	await down.connect(mariaSession);
	down.advance(EIGHT_HOURS);
	down.github.state.outage = true;
	expect(
		await ask('GitHub is down during the rotation', maria, () => down.service.userToken(maria))
	).toEqual(unavailable);
	expect(await ask('Jun has no grant, so no token', jun, () => hub.service.userToken(jun))).toEqual(
		refused
	);
	recordExampleCases(
		where('userToken', 'returns-a-live-user-token-and-rotates-an-expired-one'),
		observed
	);
});
