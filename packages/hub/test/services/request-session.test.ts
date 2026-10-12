import { expect, test } from 'vitest';
import { RequestSessionService } from '../../src/services/RequestSessionService';
import { SESSION_COOKIE } from '../../src/utils/authCookies';
import { ORIGIN, ada, authFixture, browserGrant } from '../support/authFixture';

interface Call {
	path?: string;
	method?: string;
	cookie?: string;
	bearer?: string;
	origin?: string;
}

function request(call: Call): Request {
	const headers = new Headers();
	if (call.cookie) headers.set('cookie', `${SESSION_COOKIE}=${call.cookie}`);
	if (call.bearer) headers.set('authorization', `Bearer ${call.bearer}`);
	if (call.origin) headers.set('origin', call.origin);
	return new Request(`${ORIGIN}${call.path ?? '/api/projects'}`, {
		method: call.method ?? 'GET',
		headers
	});
}

async function setup(resource = 'projects') {
	const fixture = authFixture();
	const browser = await fixture.sessions.issue(browserGrant());
	const grant = { ...browserGrant(), kind: 'native' as const, resource };
	const native = await fixture.sessions.issue({ ...grant, parentHash: browser.record.idHash });
	const service = new RequestSessionService({ sessions: fixture.sessions, origin: ORIGIN });
	return { fixture, service, cookie: browser.credential, bearer: native.credential };
}

test('a browser session arrives by cookie and a native session by Authorization header', async () => {
	const { service, cookie, bearer } = await setup();
	expect((await service.resolve(request({ cookie })))?.actor).toEqual(ada);
	expect((await service.resolve(request({ bearer })))?.kind).toBe('native');
	expect(await service.resolve(request({}))).toBeNull();
});

test('a credential is refused on the channel it was not issued for', async () => {
	const { service, cookie, bearer } = await setup();
	expect(await service.resolve(request({ bearer: cookie }))).toBeNull();
	expect(await service.resolve(request({ cookie: bearer }))).toBeNull();
	const query = new Request(`${ORIGIN}/api/projects?authorization=${bearer}&token=${bearer}`);
	expect(await service.resolve(query)).toBeNull();
});

test('an Authorization header never falls back to the cookie', async () => {
	const { service, cookie } = await setup();
	expect(await service.resolve(request({ cookie, bearer: 'x'.repeat(43) }))).toBeNull();
	const basic = request({ cookie });
	basic.headers.set('authorization', 'Basic abc');
	expect(await service.resolve(basic)).toBeNull();
});

test('a cookie session on an unsafe method needs the exact public origin', async () => {
	const { service, cookie, bearer } = await setup();
	const post = (call: Call) => service.resolve(request({ method: 'POST', ...call }));
	expect(await post({ cookie })).toBeNull();
	expect(await post({ cookie, origin: 'https://evil.example' })).toBeNull();
	expect(await post({ cookie, origin: `${ORIGIN}.evil.example` })).toBeNull();
	expect((await post({ cookie, origin: ORIGIN }))?.actor).toEqual(ada);
	expect((await post({ bearer }))?.actor).toEqual(ada);
});

test('a project-scoped native session authenticates only its project', async () => {
	const { service, bearer } = await setup('project:p-1');
	const at = (path: string) => service.resolve(request({ bearer, path }));
	expect(await at('/api/projects/p-1')).not.toBeNull();
	expect(await at('/api/projects/p-1/threads?entityId=a.b')).not.toBeNull();
	expect(await at('/api/auth/status')).not.toBeNull();
	expect(await at('/api/projects')).toBeNull();
	expect(await at('/api/projects/p-10')).toBeNull();
	expect(await at('/api/projects/p-2/snapshot')).toBeNull();
	expect(await at('/api/projects/p-2/../p-1/../p-2/snapshot')).toBeNull();
	expect(await at('/api/github/repositories')).toBeNull();
});

test('browser() takes only a live cookie session and names the failure', async () => {
	const { service, cookie, bearer, fixture } = await setup();
	expect((await service.browser(request({ cookie }))).kind).toBe('browser');
	await expect(service.browser(request({ bearer }))).rejects.toThrow('session-required');
	await expect(service.browser(request({ cookie, method: 'POST' }))).rejects.toThrow(
		'origin-denied'
	);
	const session = await fixture.sessions.find(cookie);
	await fixture.sessions.revoke(session!);
	await expect(service.browser(request({ cookie }))).rejects.toThrow('session-required');
});
