import { expect, test } from 'vitest';
import { GRANT_TTL, STATE_TTL } from '../../src/services/GithubGrantService';
import { ORIGIN, ada, browserGrant, grace } from '../support/authFixture';
import { ADA_GITHUB, GRACE_GITHUB } from '../support/githubFakeState';
import { failure, githubFixture } from '../support/githubFixture';

const refused = 'Hub auth github-not-connected';

test('the authorize URL carries state and an S256 challenge, never a secret', async () => {
	const { grants, sessions, store, app } = await githubFixture();
	const session = await sessions.issue(browserGrant());
	const url = new URL(await grants.begin(session.record));
	expect(`${url.origin}${url.pathname}`).toBe('https://github.com/login/oauth/authorize');
	expect(Object.fromEntries(url.searchParams)).toEqual({
		client_id: app.clientId,
		redirect_uri: `${ORIGIN}/api/github/callback`,
		state: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
		code_challenge: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
		code_challenge_method: 'S256'
	});
	expect(url.toString()).not.toContain(app.clientSecret);
	expect(store.dump()).not.toContain(url.searchParams.get('state'));
});

test('the code is exchanged in a form body and the tokens are stored sealed', async () => {
	const fixture = await githubFixture();
	await fixture.connect(ada, ADA_GITHUB);
	const [exchange, who] = fixture.github.state.calls;
	expect(exchange.method).toBe('POST');
	expect(exchange.url).toBe('https://github.com/login/oauth/access_token');
	expect(exchange.contentType).toBe('application/x-www-form-urlencoded');
	expect(new URLSearchParams(exchange.body).get('code_verifier')).toMatch(/^[A-Za-z0-9_-]{43}$/);
	expect(who.url).toBe('https://api.github.com/user');
	for (const call of fixture.github.state.calls) expect(new URL(call.url).search).toBe('');
	expect((await fixture.store.grants.read(ada.id)).grant).toMatchObject({
		githubUserId: ADA_GITHUB,
		login: 'ada-hub'
	});
	expect(fixture.store.dump()).not.toMatch(/gh[ur]_/);
	expect(await fixture.grants.status(ada)).toEqual({
		configured: true,
		connected: true,
		login: 'ada-hub'
	});
});

test('state is single use, bound to the session that began, and expires', async () => {
	const { grants, sessions, github, advance } = await githubFixture();
	const mine = await sessions.issue(browserGrant());
	const theirs = await sessions.issue(browserGrant(grace));
	const begin = async () => {
		const url = await grants.begin(mine.record);
		const state = new URL(url).searchParams.get('state') ?? '';
		return { state, code: github.approve(ADA_GITHUB, url) };
	};
	const stolen = await begin();
	expect(await failure(grants.complete(theirs.record, stolen))).toBe(refused);
	expect(await failure(grants.complete(mine.record, stolen))).toBe(refused);
	const forged = { ...(await begin()), state: 'f'.repeat(43) };
	expect(await failure(grants.complete(mine.record, forged))).toBe(refused);
	const late = await begin();
	advance(STATE_TTL);
	expect(await failure(grants.complete(mine.record, late))).toBe(refused);
	const once = await begin();
	await grants.complete(mine.record, once);
	expect(await failure(grants.complete(mine.record, once))).toBe(refused);
});

test('a code GitHub refuses connects nothing', async () => {
	const { grants, sessions, store } = await githubFixture();
	const session = await sessions.issue(browserGrant());
	const state = new URL(await grants.begin(session.record)).searchParams.get('state') ?? '';
	const attempt = grants.complete(session.record, { code: 'attacker-code', state });
	expect(await failure(attempt)).toBe(refused);
	expect((await store.grants.read(ada.id)).grant).toBeNull();
	expect(await grants.status(ada)).toMatchObject({ connected: false, login: null });
});

test('an expired user token is refreshed once and the rotation is stored', async () => {
	const fixture = await githubFixture();
	await fixture.connect(ada, ADA_GITHUB);
	const first = await fixture.grants.userToken(ada);
	expect(await fixture.grants.userToken(ada)).toBe(first);
	fixture.advance(28_800_000);
	const second = await fixture.grants.userToken(ada);
	expect(second).not.toBe(first);
	expect(await fixture.api.user(second)).toEqual({ id: ADA_GITHUB, login: 'ada-hub' });
	expect(await fixture.grants.userToken(ada)).toBe(second);
	expect(fixture.store.dump()).not.toMatch(/gh[ur]_/);
});

test('a refresh GitHub refuses removes the grant', async () => {
	const fixture = await githubFixture();
	await fixture.connect(ada, ADA_GITHUB);
	fixture.github.revoke(ADA_GITHUB);
	fixture.advance(28_800_000);
	expect(await failure(fixture.grants.userToken(ada))).toBe(refused);
	expect((await fixture.store.grants.read(ada.id)).grant).toBeNull();
});

test('a refreshed token that belongs to another GitHub user is refused', async () => {
	const fixture = await githubFixture();
	await fixture.connect(ada, ADA_GITHUB);
	for (const key of fixture.github.state.refreshTokens.keys()) {
		fixture.github.state.refreshTokens.set(key, GRACE_GITHUB);
	}
	fixture.advance(28_800_000);
	expect(await failure(fixture.grants.userToken(ada))).toBe(refused);
});

test('a grant without token expiry still ends with the grant lifetime', async () => {
	const fixture = await githubFixture();
	fixture.github.state.expiring = false;
	await fixture.connect(ada, ADA_GITHUB);
	fixture.advance(GRANT_TTL - 1);
	expect(await fixture.grants.userToken(ada)).toMatch(/^ghu_/);
	fixture.advance(1);
	expect(await failure(fixture.grants.userToken(ada))).toBe(refused);
});

test('a sealed token cannot be moved to another actor, and disconnect removes it', async () => {
	const fixture = await githubFixture();
	await fixture.connect(ada, ADA_GITHUB);
	const row = (await fixture.store.grants.read(ada.id)).grant;
	await fixture.store.grants.connect(0, { ...row!, actorId: grace.id });
	expect(await failure(fixture.grants.userToken(grace))).toBe(refused);
	await fixture.grants.disconnect(ada);
	expect(await failure(fixture.grants.userToken(ada))).toBe(refused);
});
