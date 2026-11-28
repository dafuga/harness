import { expect, test } from 'vitest';
import { measureWorkload } from '../../../../test/support/measureWorkload';
import { overviewKey } from '../../src/routes/api/tracker-overview/trackerOverviewCache';
import { MAX_BODY_BYTES } from '../../src/routes/api/tracker-overview/trackerOverviewInput';
import { overviewSessions } from '../../src/routes/api/tracker-overview/trackerOverviewPolicy';
import {
	NOW,
	OTHER,
	OVERVIEW_URL,
	OWNER,
	invalidSnapshots,
	overviewFixture,
	overviewRequest,
	rawPublish,
	rawRequest,
	snapshot,
	streamedPublish
} from '../support/trackerOverviewFixture';

const TTL = 90_000;

test('an unconfigured owner answers every method with the opaque not-found', async () => {
	const f = overviewFixture({ owner: null });
	const bearer = await f.native();
	for (const request of [
		overviewRequest('GET', { bearer }),
		overviewRequest('PUT', { bearer }, snapshot()),
		overviewRequest('GET')
	]) {
		const response = await f.handle(request);
		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: 'not-found' });
	}
});

test('a missing or invalid session is 401 and is checked before any body is read', async () => {
	const f = overviewFixture();
	expect((await f.handle(overviewRequest('GET'))).status).toBe(401);
	const broken = new Request(OVERVIEW_URL, { method: 'PUT', body: '{not json' });
	expect((await f.handle(broken)).status).toBe(401);
	const bogus = overviewRequest('GET', { bearer: 'x'.repeat(43) });
	expect(await f.handle(bogus)).toMatchObject({ status: 401 });
});

test('another verified actor is 403 on both methods, in either channel', async () => {
	const f = overviewFixture();
	const stranger = await f.native(OTHER);
	const strangerBrowser = await f.browser(OTHER);
	const denied = [
		overviewRequest('GET', { bearer: stranger }),
		overviewRequest('PUT', { bearer: stranger }, snapshot()),
		overviewRequest('GET', { cookie: strangerBrowser })
	];
	for (const request of denied) {
		const response = await f.handle(request);
		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({ error: 'forbidden' });
	}
});

test('only the owner native bearer in the general scope publishes; a browser cookie never does', async () => {
	const f = overviewFixture();
	const cookie = await f.browser();
	expect((await f.handle(overviewRequest('PUT', { cookie }, snapshot()))).status).toBe(403);
	const scoped = await f.native(OWNER, 'project:0a1b2c3d-0000-4000-8000-000000000000');
	expect((await f.handle(overviewRequest('GET', { bearer: scoped }))).status).toBe(401);
	expect((await f.handle(overviewRequest('PUT', { bearer: scoped }, snapshot()))).status).toBe(401);
	expect(f.bucket.objects.size).toBe(0);
});

test('the owner publishes with a bearer and reads back the same snapshot, never cached', () =>
	measureWorkload('hub.module.tracker-overview-api', 'owner-publish-and-read', async () => {
		const f = overviewFixture();
		const bearer = await f.native();
		const before = await f.handle(overviewRequest('GET', { bearer }));
		expect(before.status).toBe(503);
		expect(await before.json()).toEqual({ status: 'unavailable' });
		const current = {
			...snapshot(),
			sessionRules: [
				{
					at: '2026-11-28T11:50:42.133Z',
					incident: 'fixture123',
					skill: 'computer-hygiene',
					text: 'Close the fixture after testing.'
				}
			]
		};
		const put = await f.handle(overviewRequest('PUT', { bearer }, current));
		expect(put.status).toBe(204);
		expect(await put.text()).toBe('');
		const cookie = await f.browser();
		const get = await f.handle(overviewRequest('GET', { cookie }));
		expect(get.status).toBe(200);
		expect(await get.json()).toEqual(current);
		expect(get.headers.get('cache-control')).toBe('private, no-store');
		expect(get.headers.get('access-control-allow-origin')).toBeNull();
	}));

test('a snapshot is served for exactly 90 seconds and then unavailable', async () => {
	const f = overviewFixture();
	const bearer = await f.native();
	await f.handle(overviewRequest('PUT', { bearer }, snapshot()));
	f.advance(TTL);
	expect((await f.handle(overviewRequest('GET', { bearer }))).status).toBe(200);
	f.advance(1);
	const late = await f.handle(overviewRequest('GET', { bearer }));
	expect(late.status).toBe(503);
	expect(await late.json()).toEqual({ status: 'unavailable' });
});

test('a changed owner cannot read the previous owner data', async () => {
	const f = overviewFixture();
	const bearer = await f.native();
	await f.handle(overviewRequest('PUT', { bearer }, snapshot()));
	const next = await f.native(OTHER);
	const response = await f.handle(overviewRequest('GET', { bearer: next }), { owner: OTHER.id });
	expect(response.status).toBe(503);
	expect(await response.json()).toEqual({ status: 'unavailable' });
	const former = await f.handle(overviewRequest('GET', { bearer }), { owner: OTHER.id });
	expect(former.status).toBe(403);
});

test('a stored record from the future, with a bad shape, or not JSON is unavailable', async () => {
	const f = overviewFixture();
	const bearer = await f.native();
	const key = await overviewKey(OWNER.id);
	const bad = [
		JSON.stringify({ receivedAt: NOW + 1000, snapshot: snapshot() }),
		JSON.stringify({ receivedAt: NOW, snapshot: { ...snapshot(), liveSessions: 9 } }),
		'not json'
	];
	for (const stored of bad) {
		f.bucket.objects.set(key, stored);
		expect((await f.handle(overviewRequest('GET', { bearer }))).status).toBe(503);
	}
});

test('strictly rejects unknown, credential-bearing, malformed and inconsistent snapshots', async () => {
	const f = overviewFixture();
	const bearer = await f.native();
	for (const body of invalidSnapshots()) {
		const response = await f.handle(overviewRequest('PUT', { bearer }, body));
		expect(response.status, JSON.stringify(body).slice(0, 60)).toBe(400);
		expect(await response.json()).toEqual({ error: 'invalid-input' });
	}
	expect(f.bucket.objects.size).toBe(0);
});

test('a non-JSON content type or a malformed JSON body is refused', async () => {
	const f = overviewFixture();
	const bearer = await f.native();
	const plain = rawRequest(OVERVIEW_URL, {
		method: 'PUT',
		bearer,
		headers: { 'content-type': 'text/plain' },
		body: '{}'
	});
	const malformed = rawPublish(bearer, '{not json');
	expect((await f.handle(plain)).status).toBe(400);
	expect((await f.handle(malformed)).status).toBe(400);
});

test('bodies over 256 KiB are refused, and exactly 256 KiB is accepted', async () => {
	const f = overviewFixture();
	const bearer = await f.native();
	const json = JSON.stringify(snapshot());
	const exact = json + ' '.repeat(MAX_BODY_BYTES - json.length);
	const accepted = await f.handle(overviewRequest('PUT', { bearer }, JSON.parse(exact)));
	expect(accepted.status).toBe(204);
	const oversized = json + ' '.repeat(MAX_BODY_BYTES - json.length + 1);
	const response = await f.handle(rawPublish(bearer, oversized));
	expect(response.status).toBe(413);
	expect(await response.json()).toEqual({ error: 'artifact-too-large' });
});

test('a streamed publish with no Content-Length is cut off at 256 KiB before it is parsed', async () => {
	const f = overviewFixture();
	const { request, pulled } = streamedPublish(await f.native(), 40);
	expect((await f.handle(request)).status).toBe(413);
	expect(pulled.count).toBeLessThan(40);
	expect(f.bucket.objects.size).toBe(0);
});

test('a query, or an alias of the exact path, is refused on GET and PUT', async () => {
	const f = overviewFixture();
	const bearer = await f.native();
	const query = rawPublish(bearer, JSON.stringify(snapshot()), `${OVERVIEW_URL}?x=1`);
	expect((await f.handle(query)).status).toBe(400);
	expect(f.bucket.objects.size).toBe(0);
	for (const url of [`${OVERVIEW_URL}/`, `${OVERVIEW_URL}/index`]) {
		expect((await f.handle(rawRequest(url, { bearer }))).status).toBe(404);
	}
	expect((await f.handle(rawRequest(`${OVERVIEW_URL}?page=1`, { bearer }))).status).toBe(400);
	expect((await f.handle(rawRequest(`${OVERVIEW_URL}?page=1`))).status).toBe(401);
});

test('recognized credentials are redacted from display text before anything is stored', async () => {
	const f = overviewFixture();
	const bearer = await f.native();
	const token = 'ghp_' + 'A'.repeat(24);
	const base = snapshot();
	const card = {
		...base.projects[0],
		milestone: { text: `Synthetic ${token}`, at: base.projects[0].updatedAt }
	};
	await f.handle(overviewRequest('PUT', { bearer }, { ...base, projects: [card] }));
	const text = await (await f.handle(overviewRequest('GET', { bearer }))).text();
	expect(text).toContain('[redacted]');
	expect(text).not.toContain(token);
});

test('an unavailable publish clears the stored snapshot', async () => {
	const f = overviewFixture();
	const bearer = await f.native();
	await f.handle(overviewRequest('PUT', { bearer }, snapshot()));
	expect(
		(await f.handle(overviewRequest('PUT', { bearer }, { status: 'unavailable' }))).status
	).toBe(204);
	expect((await f.handle(overviewRequest('GET', { bearer }))).status).toBe(503);
});

test('no session store means no overview session at all', () => {
	expect(overviewSessions({})).toBeNull();
});
