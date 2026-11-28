import { expect, test } from 'vitest';
import type { HomeChatInput } from '../../../reports/src/lib/projects-sessions/hub-home/hubHome.types';
import { serveHubHome } from '../../src/routes/api/hub-home/homePolicy';
import { overviewFixture } from '../support/trackerOverviewFixture';
import { agent, homeRequest, payload, sheets } from '../support/hubHomeFixture';

/** With a published Home, the Hub queue takes the same messages a linked Mac would. */
test('the queue takes a message for Chief of Staff or the live run it showed, and nothing else', async () => {
	const { db, close } = await sheets();
	try {
		const fixture = overviewFixture();
		const serve = (request: Request) => serveHubHome(request, { ...fixture.homeDeps(), db });
		const cookie = await fixture.browser();
		const bearer = await fixture.native();
		const session = { ...agent, id: 'harbor', name: 'harbor', runId: 'mb2#104' };
		const home = { ...payload, agents: [agent, session] };
		const base = { kind: 'message', question: null, text: 'Ship it' } as const;
		const cos: HomeChatInput = {
			...base,
			id: '11111111-1111-4111-8111-111111111111',
			agentId: 'cos',
			itemId: 'cos'
		};
		const run: HomeChatInput = {
			...base,
			id: '22222222-2222-4222-8222-222222222222',
			agentId: 'harbor',
			itemId: session.itemId,
			runId: 'mb2#104'
		};
		const post = (body: object) => serve(homeRequest('POST', { cookie }, '/chat', body));
		expect(await (await post(cos)).json()).toEqual({ id: cos.id, status: 'refused' });
		expect(await (await post(run)).json()).toEqual({ id: run.id, status: 'refused' });
		const receipt = await serve(homeRequest('GET', { cookie }, `/chat?id=${cos.id}`));
		expect(await receipt.json()).toEqual({ id: cos.id, status: 'unconfirmed' });
		const published = await serve(homeRequest('PUT', { bearer }, '', home));
		expect(await published.json()).toEqual({ messages: [] });
		expect((await post(cos)).status).toBe(202);
		expect((await post(run)).status).toBe(202);
		const stale = { ...run, id: '33333333-3333-4333-8333-333333333333', runId: 'mb2#103' };
		expect(await (await post(stale)).json()).toEqual({ id: stale.id, status: 'refused' });
		const unnamed = { ...run, id: '44444444-4444-4444-8444-444444444444', runId: undefined };
		expect((await post(unnamed)).status).toBe(400);
		const claimed = await serve(homeRequest('PUT', { bearer }, '', home));
		const { messages } = (await claimed.json()) as { messages: HomeChatInput[] };
		expect(messages.map((entry) => entry.id).sort()).toEqual([cos.id, run.id]);
	} finally {
		await close();
	}
});
