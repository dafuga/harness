// Example states for hub.service.github-grant: the real service, adapter and secrets over the in-memory store and GitHub fake.
import type { Actor } from 'collaboration';
import { test } from 'vitest';
import { GithubApiAdapter } from '../../src/lib/verification-evidence/server/auth/GithubApiAdapter';
import { GithubGrantService, GRANT_TTL, STATE_TTL } from '../../src/lib/verification-evidence/server/auth/GithubGrantService';
import { authSecrets } from '../../src/lib/verification-evidence/server/auth/authSecrets';
import type { GithubStateRecord, SessionRecord } from '../../src/models/accounts-access/HubAuthStore.types';
import { AuthFailure } from '../../src/utils/accounts-access/authFail';
import { sha256Url } from '../../src/utils/verification-evidence/authSecrets';
import { GRACE_GITHUB } from '../support/githubFakeState';
import { holdGithub } from '../support/githubFixture';
import { githubFake } from '../support/githubFake';
import { memoryAuthStore } from '../support/memoryAuthStore';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

type Observed = Parameters<typeof recordExampleCases>[1];
type Outcome = { output: unknown } | { error: { name: string; code: string; message: string } };
const ORIGIN = 'https://hub.example.com';
const AUTHORIZE = 'https://github.com/login/oauth/authorize';
const SECRET = 'synthetic-session-secret-for-github-grant-examples';
const START = 1794735000000;
const WEEK = 604_800_000;
const EIGHT_HOURS = 28_800_000;
const UNKNOWN_STATE = 'k3Jx9QwVb2LzT7rNcE5hGyP0mD8sFaU1oRi6WtYvBnA';
const BASE64URL = /^[A-Za-z0-9_-]{43}$/;
const MARIA_GITHUB = 60110001;
const secrets = authSecrets(SECRET);
const person = (id: string, email: string, name: string): Actor => ({ id, email, name, emailVerified: true });
const session = (actor: Actor, idHash: string, parentHash: string | null, createdAt: number): SessionRecord => ({
	idHash, kind: 'browser', parentHash, actor, resource: 'projects', createdAt, expiresAt: createdAt + WEEK, revokedAt: null
});
const maria = person('google-103947562018374650912', 'maria.rivera@example.com', 'Maria Rivera');
const jun = person('google-118236491075628390174', 'jun.park@example.org', 'Jun Park');
const mariaSession = session(maria, '5e8a1c4f7b2d9e03a6c1f8b4d2e7a9c05f3b6d1e8a2c4f7b9d0e3a5c6f1b8d24', null, START);
const junSession = session(jun, '0b7e4d2a9c1f5e83d6a0b4c7f2e9d1a5c8b3f6e0d4a7c9b2f1e5d8a3c6b0f947', 'a3d7f1c9e5b2084f6d1a9c3e7b5f2d80c4a6e1b9f3d7c2a5e8b0f4d6c1a9e372', 1794746400000);

const failed = (code: string): Outcome => ({ error: { name: 'AuthFailure', code, message: `Hub auth ${code}` } });
const refused = failed('github-not-connected');
const unavailable = failed('github-unavailable');
const none: Outcome = { output: null };
const disconnected = { configured: true, connected: false, login: null };
const connected = { configured: true, connected: true, login: 'octo-cat' };
/** GitHub tokens are random, so the evidence keeps only their prefix and length. */
const shape = (token: string) => ({ prefix: token.slice(0, 4), length: token.length });
const where = (symbol: string, state: string) => ({ unitId: 'hub.service.github-grant', symbol, state, evidence: 'examples-cases', file: `${state}.json` });

/** Runs one call, records what it was given and what came back, and returns the outcome. */
async function attempt(observed: Observed, name: string, input: unknown, run: () => Promise<unknown>): Promise<Outcome> {
	let result: Outcome;
	try {
		result = { output: (await run()) ?? null };
	} catch (error) {
		if (!(error instanceof AuthFailure)) throw error;
		result = { error: { name: error.name, code: error.code, message: error.message } };
	}
	observed.push({ name, input, ...result });
	return result;
}

/** The real service over the in-memory store and GitHub fake, with a clock the test moves by hand. */
async function fixture() {
	let clock = START;
	const github = await githubFake(() => clock);
	github.state.logins.set(MARIA_GITHUB, 'octo-cat');
	const store = memoryAuthStore();
	const app = { ...github.state.app, collaboration: null };
	const api = new GithubApiAdapter({ fetch: github.fetch });
	const service = new GithubGrantService({ app, api, store, secrets, origin: ORIGIN, now: () => clock });
	const start = async (record: SessionRecord) => {
		const url = await service.begin(record);
		const code = github.approve(MARIA_GITHUB, url);
		return { code, state: new URL(url).searchParams.get('state') ?? '' };
	};
	const connect = async (record: SessionRecord) => service.complete(record, await start(record));
	const advance = (milliseconds: number) => (clock += milliseconds);
	return { service, github, store, start, connect, advance };
}

test('Begins a flow with a hashed state and an S256 challenge', async () => {
	const observed: Observed = [];
	for (const record of [mariaSession, junSession]) {
		const hub = await fixture();
		const url = new URL(await hub.service.begin(record));
		const state = url.searchParams.get('state') ?? '';
		const [row] = JSON.parse(hub.store.dump()) as GithubStateRecord[];
		const verifier = await secrets.open(row.verifierCipher, `github-state:${record.idHash}`);
		expect({ base: url.origin + url.pathname, ...Object.fromEntries(url.searchParams) }).toEqual({
			base: AUTHORIZE,
			client_id: hub.github.state.app.clientId,
			redirect_uri: `${ORIGIN}/api/github/callback`,
			state: expect.stringMatching(BASE64URL),
			code_challenge: await sha256Url(verifier ?? ''),
			code_challenge_method: 'S256'
		});
		expect(row).toEqual({
			idHash: await secrets.hash('github-state', state),
			sessionHash: record.idHash,
			actorId: record.actor.id,
			grantGeneration: 0,
			verifierCipher: expect.stringMatching(/^v1\./),
			expiresAt: START + STATE_TTL
		});
		observed.push({ name: `${record.actor.name} starts a flow`, input: record, output: { authorize: AUTHORIZE, state_length: state.length } });
	}
	recordExampleCases(where('begin', 'begins-a-flow-with-a-hashed-state-and-an-s256-challenge'), observed);
});

test('Completes a flow once and stores the grant for its session', async () => {
	const observed: Observed = [];
	const ask = (name: string, input: unknown, run: () => Promise<unknown>) => attempt(observed, name, input, run);
	const hub = await fixture();
	const given = { session: mariaSession, code: 'approved on GitHub', state: 'issued by begin' };
	const first = await hub.start(mariaSession);
	const finish = () => hub.service.complete(mariaSession, first);
	expect(await ask('Maria completes the flow her browser began', given, finish)).toEqual(none);
	expect(await hub.service.status(maria)).toEqual(connected);
	expect(await ask('the same state is refused a second time', given, finish)).toEqual(refused);
	const forged = { ...(await hub.start(mariaSession)), code: 'c41e08d9b26a7f3e5d10' };
	const forgedInput = { ...given, code: 'c41e08d9b26a7f3e5d10' };
	expect(await ask('a code GitHub never approved is refused', forgedInput, () => hub.service.complete(mariaSession, forged))).toEqual(refused);
	const bound = await hub.start(mariaSession);
	const boundInput = { ...given, session: junSession };
	expect(await ask('a state begun by another session is refused', boundInput, () => hub.service.complete(junSession, bound))).toEqual(refused);
	const missing = { code: '7f3a9c2e1b8d4f60a5c7', state: UNKNOWN_STATE };
	const missingInput = { session: mariaSession, ...missing };
	expect(await ask('a state that was never issued is refused', missingInput, () => hub.service.complete(mariaSession, missing))).toEqual(refused);
	const moved = await hub.start(mariaSession);
	await hub.service.disconnect(maria);
	expect(await ask('the grant changed after the flow began', given, () => hub.service.complete(mariaSession, moved))).toEqual(refused);
	const late = await hub.start(mariaSession);
	hub.github.state.outage = true;
	expect(await ask('GitHub is down during the code exchange', given, () => hub.service.complete(mariaSession, late))).toEqual(unavailable);
	recordExampleCases(where('complete', 'completes-a-flow-once-and-stores-the-grant-for-its-session'), observed);
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
	const ask = (name: string, input: Actor, run: () => Promise<unknown>) => attempt(observed, name, input, run);
	const hub = await fixture();
	await hub.connect(mariaSession);
	expect(await ask('Maria disconnects her connected grant', maria, () => hub.service.disconnect(maria))).toEqual(none);
	expect(await hub.service.status(maria)).toEqual(disconnected);
	expect(await hub.store.grants.read(maria.id)).toEqual({ generation: 2, grant: null, refreshingUntil: null });
	expect(await ask('Jun has no grant and still resolves', jun, () => hub.service.disconnect(jun))).toEqual(none);
	recordExampleCases(where('disconnect', 'erases-the-grant-and-leaves-a-tombstone'), observed);
});

test('Returns a live user token and rotates an expired one', async () => {
	const observed: Observed = [];
	const ask = (name: string, input: Actor, run: () => Promise<unknown>) => attempt(observed, name, input, run);
	const hub = await fixture();
	await hub.connect(mariaSession);
	const stored = await hub.service.userToken(maria);
	expect(await hub.service.userToken(maria)).toBe(stored);
	observed.push({ name: 'Maria: the stored token while it is fresh', input: maria, output: shape(stored) });
	hub.advance(EIGHT_HOURS);
	const rotated = await hub.service.userToken(maria);
	expect(rotated).not.toBe(stored);
	expect(await hub.service.userToken(maria)).toBe(rotated);
	observed.push({ name: 'Maria: the expired token is rotated', input: maria, output: shape(rotated) });

	const contested = await fixture();
	await contested.connect(mariaSession);
	contested.advance(EIGHT_HOURS);
	const hold = holdGithub(contested.github, (call) => call.body.includes('grant_type=refresh_token'));
	const holder = contested.service.userToken(maria);
	await hold.reached;
	expect(await ask('a second caller inside the 30 second lease', maria, () => contested.service.userToken(maria))).toEqual(unavailable);
	hold.release();
	observed.push({ name: 'the caller holding the lease gets the rotated token', input: maria, output: shape(await holder) });
	contested.advance(EIGHT_HOURS);
	const again = holdGithub(contested.github, (call) => call.body.includes('grant_type=refresh_token'));
	const inFlight = contested.service.userToken(maria);
	await again.reached;
	await contested.service.disconnect(maria);
	again.release();
	expect(await ask('a rotation in flight cannot write back after a disconnect', maria, () => inFlight)).toEqual(refused);

	const revoked = await fixture();
	await revoked.connect(mariaSession);
	revoked.github.revoke(MARIA_GITHUB);
	revoked.advance(EIGHT_HOURS);
	expect(await ask('GitHub refuses the refresh token', maria, () => revoked.service.userToken(maria))).toEqual(refused);
	expect(await revoked.service.status(maria)).toEqual(disconnected);

	const swapped = await fixture();
	await swapped.connect(mariaSession);
	for (const key of swapped.github.state.refreshTokens.keys()) swapped.github.state.refreshTokens.set(key, GRACE_GITHUB);
	swapped.advance(EIGHT_HOURS);
	expect(await ask('GitHub answers the refresh for another user', maria, () => swapped.service.userToken(maria))).toEqual(refused);

	const down = await fixture();
	await down.connect(mariaSession);
	down.advance(EIGHT_HOURS);
	down.github.state.outage = true;
	expect(await ask('GitHub is down during the rotation', maria, () => down.service.userToken(maria))).toEqual(unavailable);
	expect(await ask('Jun has no grant, so no token', jun, () => hub.service.userToken(jun))).toEqual(refused);
	recordExampleCases(where('userToken', 'returns-a-live-user-token-and-rotates-an-expired-one'), observed);
});
