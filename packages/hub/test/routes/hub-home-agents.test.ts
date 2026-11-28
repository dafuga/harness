import { expect, test } from 'vitest';
import { serveHubHome } from '../../src/routes/api/hub-home/homePolicy';
import { OTHER, overviewFixture } from '../support/trackerOverviewFixture';
import { agent, homeRequest, id, payload, sheets } from '../support/hubHomeFixture';

test('the Hub keeps every project, lets Daniel add and remove sessions he created, and answers asks of agent-created ones', async () => {
	const { db, close } = await sheets();
	try {
		const fixture = overviewFixture();
		const serve = (request: Request) => serveHubHome(request, { ...fixture.homeDeps(), db });
		const cookie = await fixture.browser();
		const bearer = await fixture.native();
		const other = await fixture.browser(OTHER);
		const options = [
			{ label: 'Ship it', effect: 'Merges the change.' },
			{ label: 'Wait', effect: 'Holds.' }
		];
		const harbor = {
			...agent,
			id: 'harbor',
			name: 'harbor',
			itemId: 'harbor-1',
			question: 'Ship harbor?',
			options
		};
		const nudge = { ...harbor, id: 'nudge', name: 'nudge', state: 'working', sessions: 1 };
		const read = async () => (await serve(homeRequest('GET', { cookie }))).json();
		expect(await read()).toMatchObject({ snapshot: null, controlled: [] });
		const add = (body: unknown, method = 'POST', session = cookie) =>
			serve(homeRequest(method, { cookie: session }, '/agents', body));
		expect((await add({ id: 'harbor' }, 'POST', other)).status).toBe(404);
		expect((await add({ id: 'not valid!' })).status).toBe(400);
		expect(await (await add({ id: 'harbor' })).json()).toEqual({ controlled: ['harbor'] });
		expect(await (await add({ id: 'harbor' })).json()).toEqual({ controlled: ['harbor'] });
		expect(await read()).toMatchObject({ snapshot: null, controlled: ['harbor'] });
		expect(await (await add({ id: 'harbor' }, 'DELETE')).json()).toEqual({ controlled: [] });
		expect(await read()).toMatchObject({ snapshot: null, controlled: [] });
		// The optional publisher still sends every Tracker project as an agent.
		await serve(homeRequest('PUT', { bearer }, '', { ...payload, agents: [agent, harbor, nudge] }));
		expect(await read()).toMatchObject({
			snapshot: { agents: [{ id: 'cos' }, { id: 'harbor' }, { id: 'nudge' }] }
		});
		// A tap on an ask from an agent-created project reaches the Tracker queue.
		const tap = {
			id,
			agentId: 'nudge',
			itemId: 'harbor-1',
			kind: 'answer',
			text: 'Ship it',
			question: 'Ship harbor?',
			option: 1
		};
		expect((await serve(homeRequest('POST', { cookie }, '/chat', tap))).status).toBe(202);
	} finally {
		await close();
	}
});
