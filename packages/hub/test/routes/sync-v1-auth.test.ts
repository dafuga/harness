import { expect, test } from 'vitest';
import { serveSync } from '../../src/routes/api/sync/syncPolicy';
import { SESSION_COOKIE } from '../../src/utils/accounts-access/authCookies';
import { ORIGIN } from '../support/authFixture';
import { OTHER, OWNER, overviewFixture } from '../support/trackerOverviewFixture';

const device = 'AAAAAAAAAAAAAAAAAAAAAA';

/** A database that records the account of every query and has no rows. */
function database() {
	const accounts: unknown[] = [];
	const statement = {
		bind: (...values: unknown[]) => {
			accounts.push(values[0]);
			return statement;
		},
		all: async () => ({ results: [] }),
		run: async () => ({ meta: { changes: 0 } })
	};
	return { accounts, db: { prepare: () => statement } as unknown as D1Database };
}

function request(method: string, path: string, credential: { cookie?: string; bearer?: string }) {
	const headers = new Headers({ 'x-harness-device': device });
	if (credential.cookie) {
		headers.set('cookie', `${SESSION_COOKIE}=${credential.cookie}`);
		headers.set('origin', ORIGIN);
	}
	if (credential.bearer) headers.set('authorization', `Bearer ${credential.bearer}`);
	const body = method === 'POST' ? '{}' : null;
	return new Request(`${ORIGIN}/api/sync/v1/${path}`, { method, headers, body });
}

async function serve(
	fixture: ReturnType<typeof overviewFixture>,
	call: Request,
	db: D1Database | undefined
) {
	const { sessions } = fixture.homeDeps();
	return serveSync(call, { sessions, db, bucket: undefined, accounts: null, now: 0 });
}

test('the account is the verified actor, on the cookie or the bearer channel and no other', async () => {
	const fixture = overviewFixture();
	const { accounts, db } = database();
	const cookie = await fixture.browser(OWNER),
		bearer = await fixture.native(OTHER),
		scoped = await fixture.native(OWNER, 'project:synthetic');
	const status = async (call: Request, store: D1Database | null = db) =>
		(await serve(fixture, call, store ?? undefined)).status;
	expect(await status(request('GET', 'chain', {}))).toBe(401);
	expect(await status(request('GET', 'chain', { cookie: 'forged' }))).toBe(401);
	expect(await status(request('GET', 'chain', { bearer: 'forged' }))).toBe(401);
	expect(await status(request('GET', 'chain', { bearer: scoped }))).toBe(401);
	expect(await status(request('GET', 'chain', { cookie }))).toBe(200);
	expect(await status(request('GET', 'chain', { bearer }))).toBe(200);
	expect(accounts).toEqual([OWNER.id, OTHER.id]);
	expect(await status(request('GET', 'chain', { cookie }), null)).toBe(404);
});

test('a cookie cannot write from another origin, and a bearer is never mixed with a cookie', async () => {
	const fixture = overviewFixture();
	const { db } = database();
	const cookie = await fixture.browser(OWNER);
	const post = request('POST', 'chain', { cookie });
	const crossSite = new Request(post.url, {
		method: 'POST',
		headers: new Headers(post.headers),
		body: '{}'
	});
	crossSite.headers.delete('origin');
	expect((await serve(fixture, crossSite, db)).status).toBe(401);
	expect((await serve(fixture, request('POST', 'chain', { cookie }), db)).status).toBe(400);
	const mixed = request('GET', 'chain', { cookie, bearer: 'forged' });
	expect((await serve(fixture, mixed, db)).status).toBe(401);
});
