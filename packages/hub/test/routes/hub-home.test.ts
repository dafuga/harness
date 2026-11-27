import { expect, test } from 'vitest';
import type { HomeChatInput } from '../../../reports/src/lib/projects-sessions/hub-home/hubHome.types';
import { serveHubHome } from '../../src/routes/api/hub-home/homePolicy';
import { OTHER, OWNER, overviewFixture } from '../support/trackerOverviewFixture';
import { agent, homeRequest, id, message, payload, plan, sheets } from '../support/hubHomeFixture';

test('the browser owner queues one scoped message, only native claims it, and a receipt is private', async () => {
	const { db, close } = await sheets();
	try {
		const fixture = overviewFixture();
		const serve = (request: Request) => serveHubHome(request, { ...fixture.homeDeps(), db });
		const cookie = await fixture.browser();
		const bearer = await fixture.native();
		const other = await fixture.browser(OTHER);
		const scoped = await fixture.native(OWNER, 'project:synthetic');
		expect((await serve(homeRequest('PUT', { cookie }, '', payload))).status).toBe(404);
		expect((await serve(homeRequest('PUT', { bearer: scoped }, '', payload))).status).toBe(404);
		const published = { ...payload, plans: [plan] };
		const first = await serve(homeRequest('PUT', { bearer }, '', published));
		expect(await first.json()).toEqual({ messages: [] });
		expect(await (await serve(homeRequest('GET', { cookie }))).json()).toMatchObject({
			granted: true,
			snapshot: { plans: [plan] }
		});
		const denied = await serve(homeRequest('GET', { cookie: other }));
		expect(await denied.json()).toEqual({ granted: false, snapshot: null });
		expect(denied.headers.get('cache-control')).toBe('private, no-store');
		const stale = await serve(
			homeRequest('POST', { cookie }, '/chat', { ...message, question: 'An earlier question' })
		);
		expect(await stale.json()).toEqual({ id, status: 'refused' });
		expect((await serve(homeRequest('POST', { cookie: other }, '/chat', message))).status).toBe(
			404
		);
		const crossed = homeRequest('POST', { cookie }, '/chat', message);
		crossed.headers.set('origin', 'https://other.example.invalid');
		expect((await serve(crossed)).status).toBe(404);
		expect((await serve(homeRequest('POST', { cookie }, '/chat', message))).status).toBe(202);
		expect((await serve(homeRequest('POST', { cookie }, '/chat', message))).status).toBe(202);
		const claims = await Promise.all(
			[0, 1].map(async () => {
				const result = await serve(homeRequest('PUT', { bearer }, '', payload));
				return ((await result.json()) as { messages: HomeChatInput[] }).messages;
			})
		);
		expect(claims.flat()).toEqual([message]);
		expect(
			(await serve(homeRequest('PUT', { bearer }, '/chat', { id, status: 'sent' }))).status
		).toBe(200);
		const browser = await serve(homeRequest('GET', { cookie }, `/chat?id=${id}`));
		expect(await browser.json()).toEqual({ id, status: 'sent' });
		expect((await serve(homeRequest('GET', { cookie: other }, `/chat?id=${id}`))).status).toBe(404);
	} finally {
		await close();
	}
});

test('an owner-disabled route is neutral and never stores or reads a projection', async () => {
	const fixture = overviewFixture({ owner: null });
	const cookie = await fixture.browser();
	const response = await serveHubHome(homeRequest('GET', { cookie }), fixture.homeDeps());
	expect(await response.json()).toEqual({ granted: false, snapshot: null });
	expect(fixture.bucket.objects.size).toBe(0);
});

test('a tapped option must name a real option of the open ask, and a confirm ask must be confirmed', async () => {
	const { db, close } = await sheets();
	try {
		const fixture = overviewFixture();
		const serve = (request: Request) => serveHubHome(request, { ...fixture.homeDeps(), db });
		const cookie = await fixture.browser();
		const bearer = await fixture.native();
		const options = [
			{ label: 'Ship it', effect: 'Merges the change.', recommended: true },
			{ label: 'Wait', effect: 'Holds until tomorrow.' }
		];
		const asked = { ...agent, options, confirm: 'deploy' };
		const published = {
			...payload,
			agents: [{ ...asked, itemId: 'a-different-item' }],
			openAsks: [
				{
					itemId: asked.itemId,
					agentId: asked.id,
					agentName: asked.name,
					title: asked.task,
					question: asked.question,
					options,
					confirm: asked.confirm,
					since: asked.since
				}
			]
		};
		const sent = await serve(homeRequest('PUT', { bearer }, '', published));
		expect(sent.status).toBe(200);
		const tap = { ...message, text: 'Ship it', option: 1 };
		const refuse = async (body: unknown) => {
			const response = await serve(homeRequest('POST', { cookie }, '/chat', body));
			expect(await response.json()).toEqual({ id, status: 'refused' });
		};
		await refuse(tap);
		await refuse({ ...tap, confirmed: true, text: 'Something else' });
		await refuse({ ...tap, confirmed: true, option: 3, text: 'Ship it' });
		await refuse({ ...tap, confirmed: true, question: 'The previous flag' });
		const confirmed = { ...tap, confirmed: true };
		expect((await serve(homeRequest('POST', { cookie }, '/chat', confirmed))).status).toBe(202);
		const claimed = await serve(homeRequest('PUT', { bearer }, '', published));
		expect(((await claimed.json()) as { messages: HomeChatInput[] }).messages).toEqual([confirmed]);
		const invalid = { ...message, kind: 'note', question: null, option: 1 };
		expect((await serve(homeRequest('POST', { cookie }, '/chat', invalid))).status).toBe(400);
	} finally {
		await close();
	}
});
