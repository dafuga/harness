import { expect, test } from 'vitest';
import { ada, browserGrant } from '../support/authFixture';
import { ADA_GITHUB, GRACE_GITHUB } from '../support/githubFakeState';
import type { FakeCall } from '../support/githubFakeState';
import { failure, githubFixture, holdGithub } from '../support/githubFixture';
import type { GithubFixture } from '../support/githubFixture';

const refused = 'Hub auth github-not-connected';
const EIGHT_HOURS = 28_800_000;
const tokenCall = (call: FakeCall) => call.url.endsWith('/login/oauth/access_token');
const refreshCall = (call: FakeCall) =>
	tokenCall(call) && call.body.includes('grant_type=refresh_token');
const status = (fixture: GithubFixture) => fixture.grants.status(ada);

/** Ada connected as `ada-hub`, eight hours ago: her user token now needs a rotation. */
async function expired(): Promise<GithubFixture> {
	const fixture = await githubFixture();
	await fixture.connect(ada, ADA_GITHUB);
	fixture.advance(EIGHT_HOURS);
	return fixture;
}

/** Who a pending token request ends up acting as on GitHub; null when it was refused. */
function actingAs(fixture: GithubFixture, pending: Promise<string>): Promise<number | null> {
	return pending.then(
		async (token) => (await fixture.api.user(token))?.id ?? null,
		() => null
	);
}

test('a disconnect during a token rotation is final', async () => {
	const fixture = await expired();
	const held = holdGithub(fixture.github, refreshCall);
	const pending = failure(fixture.grants.userToken(ada));
	await held.reached;
	await fixture.grants.disconnect(ada);
	expect((await status(fixture)).connected).toBe(false);
	held.release();
	expect(await pending).toBe(refused);
	expect(await status(fixture)).toEqual({ configured: true, connected: false, login: null });
	expect(await failure(fixture.grants.userToken(ada))).toBe(refused);
	expect(fixture.store.dump()).not.toContain('"v1.');
});

test('a disconnect during an OAuth callback is final', async () => {
	const fixture = await githubFixture();
	const session = await fixture.sessions.issue(browserGrant());
	const url = await fixture.grants.begin(session.record);
	const state = new URL(url).searchParams.get('state') ?? '';
	const input = { code: fixture.github.approve(ADA_GITHUB, url), state };
	const held = holdGithub(fixture.github, tokenCall);
	const pending = failure(fixture.grants.complete(session.record, input));
	await held.reached;
	await fixture.grants.disconnect(ada);
	held.release();
	expect(await pending).toBe(refused);
	expect((await status(fixture)).connected).toBe(false);
	expect(await failure(fixture.grants.userToken(ada))).toBe(refused);
});

test('an older connection attempt cannot replace a newer one', async () => {
	const fixture = await githubFixture();
	const session = await fixture.sessions.issue(browserGrant());
	const attempt = async (githubUser: number) => {
		const url = await fixture.grants.begin(session.record);
		const state = new URL(url).searchParams.get('state') ?? '';
		return { code: fixture.github.approve(githubUser, url), state };
	};
	const older = await attempt(ADA_GITHUB);
	const newer = await attempt(GRACE_GITHUB);
	const held = holdGithub(fixture.github, (call) => call.body.includes(`code=${older.code}`));
	const pending = failure(fixture.grants.complete(session.record, older));
	await held.reached;
	await fixture.grants.complete(session.record, newer);
	expect((await status(fixture)).login).toBe('grace-hub');
	held.release();
	expect(await pending).toBe(refused);
	expect((await status(fixture)).login).toBe('grace-hub');
	expect(await actingAs(fixture, fixture.grants.userToken(ada))).toBe(GRACE_GITHUB);
});

test('a reconnection during a rotation keeps the new connection and hides the stale token', async () => {
	const fixture = await expired();
	const held = holdGithub(fixture.github, refreshCall);
	const pending = actingAs(fixture, fixture.grants.userToken(ada));
	await held.reached;
	await fixture.connect(ada, GRACE_GITHUB);
	held.release();
	expect([null, GRACE_GITHUB]).toContain(await pending);
	expect(await status(fixture)).toMatchObject({ connected: true, login: 'grace-hub' });
	expect(await actingAs(fixture, fixture.grants.userToken(ada))).toBe(GRACE_GITHUB);
});

test('a rotation GitHub refuses cannot remove a newer connection', async () => {
	const fixture = await expired();
	fixture.github.revoke(ADA_GITHUB);
	const held = holdGithub(fixture.github, refreshCall);
	const pending = actingAs(fixture, fixture.grants.userToken(ada));
	await held.reached;
	await fixture.connect(ada, GRACE_GITHUB);
	held.release();
	expect([null, GRACE_GITHUB]).toContain(await pending);
	expect(await status(fixture)).toMatchObject({ connected: true, login: 'grace-hub' });
	expect(await actingAs(fixture, fixture.grants.userToken(ada))).toBe(GRACE_GITHUB);
});

test('concurrent callers rotate the tokens once and nobody loses the connection', async () => {
	const fixture = await expired();
	const callers = [1, 2, 3].map(() => fixture.grants.userToken(ada));
	const results = await Promise.allSettled(callers);
	expect(fixture.github.state.calls.filter(refreshCall)).toHaveLength(1);
	const failures = results.flatMap((result) =>
		result.status === 'rejected' ? [String((result.reason as Error).message)] : []
	);
	expect(failures).toEqual(['Hub auth github-unavailable', 'Hub auth github-unavailable']);
	const [winner] = results.flatMap((result) =>
		result.status === 'fulfilled' ? [result.value] : []
	);
	expect(await actingAs(fixture, Promise.resolve(winner))).toBe(ADA_GITHUB);
	expect(await status(fixture)).toMatchObject({ connected: true, login: 'ada-hub' });
	expect(await fixture.grants.userToken(ada)).toBe(winner);
});

test('a rotation interrupted by an outage is retried once its lease has run out', async () => {
	const fixture = await expired();
	fixture.github.state.outage = true;
	expect(await failure(fixture.grants.userToken(ada))).toBe('Hub auth github-unavailable');
	fixture.github.state.outage = false;
	expect(await failure(fixture.grants.userToken(ada))).toBe('Hub auth github-unavailable');
	expect(fixture.github.state.calls.filter(refreshCall)).toHaveLength(1);
	fixture.advance(30_000);
	expect(await actingAs(fixture, fixture.grants.userToken(ada))).toBe(ADA_GITHUB);
	expect(await status(fixture)).toMatchObject({ connected: true, login: 'ada-hub' });
});
