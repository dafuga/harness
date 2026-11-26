import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import {
	buildHomeSnapshot,
	noProviders
} from '../../../reports/src/lib/projects-sessions/hub-home/homeTrackerProjection';
import { readTrackerSources } from '../../../reports/src/lib/projects-sessions/project-overview/projectOverviewTracker';
import { deliverHomeChat } from '../../../desktop/src/lib/development-tooling/desktop-initialization/tracker-overview-publisher/homeTrackerChat';
import { TrackerItemReadRepository } from '../../../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerRunReadRepository } from '../../../../src/repositories/projects-sessions/TrackerRunReadRepository';
import { TrackerLocalApiService } from '../../../../src/services/projects-sessions/TrackerLocalApiService';
import { TrackerPersistenceService } from '../../../../src/services/projects-sessions/TrackerPersistenceService';
import { listHomeAgents } from '../../../reports/src/lib/projects-sessions/hub-home/homeDirectAgents';
import { chatInput, parseHomePayload } from '../../src/routes/api/hub-home/homePayload';

const now = Date.UTC(2026, 10, 25, 12);
const options = [
	{ label: 'Ship it', effect: 'Merges the change.', recommended: true },
	{ label: 'Wait', effect: 'Holds until tomorrow.' }
];

/*
 * Covers the Mac's Tracker write only: it calls deliverHomeChat itself, so it says nothing about
 * the Hub routes, the connection or the installed app's settings. That chain is
 * tests/e2e/hub-home-installed-chain.spec.ts.
 */

/** A real Tracker API on an in-memory store, reached through the same fixed loopback URLs. */
function liveTracker() {
	const database = new DatabaseSync(':memory:');
	const store = new TrackerPersistenceService(database, 'fixture-hub', { now: () => now });
	const items = new TrackerItemReadRepository(database);
	const api = new TrackerLocalApiService(store, items, {
		now: () => now,
		runs: new TrackerRunReadRepository(database, store.node)
	});
	const fetcher = (async (input: string | URL, init?: RequestInit) => {
		// The in-memory API has no machine list; the overview only needs it to be an empty list.
		if (String(input).endsWith('/machines')) return Response.json([]);
		return api.handle(new Request(String(input), init));
	}) as typeof fetch;
	const post = (path: string, body: object) =>
		api.handle(
			new Request(`http://127.0.0.1:7701${path}`, { method: 'POST', body: JSON.stringify(body) })
		);
	return { store, fetcher, post, items, close: () => database.close() };
}

async function askedAgent(tracker: ReturnType<typeof liveTracker>, confirm?: string) {
	tracker.store.appendLocal({
		itemId: 'asked1',
		fields: { title: 'Synthetic release', agent: 'Synthetic agent', status: 'open' }
	});
	const flag = await tracker.post('/items/asked1/flag', {
		question: 'Ship the synthetic release?',
		options,
		...(confirm && { confirm })
	});
	expect(flag.status).toBe(200);
	const sources = await readTrackerSources(tracker.fetcher, true);
	return buildHomeSnapshot(sources, noProviders, now);
}

test('a flag with options reaches the Hub, and a tap answers it on the Tracker by Daniel via Hub', async () => {
	const tracker = liveTracker();
	try {
		const home = await askedAgent(tracker);
		const parsed = parseHomePayload(JSON.parse(JSON.stringify(home)));
		// The asking project is not a user-controlled session, so it is an ask, not an agent.
		const listed = listHomeAgents(parsed.agents);
		expect(listed.agents).toEqual([]);
		const agent = listed.asks[0];
		expect(agent).toMatchObject({ question: 'Ship the synthetic release?', options });
		const tap = chatInput.parse({
			id: crypto.randomUUID(),
			agentId: agent.id,
			itemId: agent.itemId,
			kind: 'answer',
			question: agent.question,
			text: 'Ship it',
			option: 1
		});
		const receipt = await deliverHomeChat(tap, home, tracker.fetcher);
		expect(receipt.status).toBe('sent');
		const answered = tracker.items.get('asked1');
		expect(answered).toMatchObject({
			needs_daniel: false,
			answer: 'Ship it',
			answer_option: 1,
			answered_by: 'Daniel via Hub'
		});
		expect(answered?.answered_at).toBeTruthy();
	} finally {
		tracker.close();
	}
});

test('a deploy ask is refused until the tap is confirmed, then it is answered', async () => {
	const tracker = liveTracker();
	try {
		const home = await askedAgent(tracker, 'deploy');
		expect(listHomeAgents(home.agents).asks[0]).toMatchObject({ confirm: 'deploy' });
		const base = {
			id: crypto.randomUUID(),
			agentId: home.agents[0].id,
			itemId: 'asked1',
			kind: 'answer' as const,
			question: 'Ship the synthetic release?',
			text: 'Ship it',
			option: 1
		};
		expect((await deliverHomeChat(base, home, tracker.fetcher)).status).toBe('refused');
		expect(tracker.items.get('asked1')).toMatchObject({ needs_daniel: true, answer: null });
		const confirmed = { ...base, confirmed: true as const };
		expect((await deliverHomeChat(confirmed, home, tracker.fetcher)).status).toBe('sent');
		expect(tracker.items.get('asked1')).toMatchObject({ needs_daniel: false, answer_option: 1 });
	} finally {
		tracker.close();
	}
});
