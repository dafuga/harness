import { expect, test } from 'vitest';
import {
	buildHomeSnapshot,
	noProviders
} from '../../../reports/src/lib/projects-sessions/hub-home/homeTrackerProjection';
import { listHomeAgents } from '../../../reports/src/lib/projects-sessions/hub-home/homeDirectAgents';
import { homeChatInput } from '../../../reports/src/lib/projects-sessions/hub-home/homeChatInput';
import type { HomeChatInput } from '../../../reports/src/lib/projects-sessions/hub-home/hubHome.types';
import { deliverHomeChat } from '../../../desktop/src/lib/development-tooling/desktop-initialization/tracker-overview-publisher/homeTrackerChat';
import { messageStatusText } from '../../../reports/src/components/projects-sessions/hub-home/hubHomePresentation';
import {
	composerFeedback,
	homeChatItemSuffix
} from '../../../reports/src/components/projects-sessions/hub-home/hubHomeMessages';
import {
	formatHubDeliveredNote,
	formatHubMessageNote,
	formatHubReplyNote,
	formatHubWaitingNote
} from '../../../../src/utils/projects-sessions/hubSessionMessages';

/** The Hub thread is read from keyed message notes, never guessed from the latest notes. */
const now = Date.parse('2026-11-26T17:30:00Z');
const at = (minute: number) => new Date(now - (30 - minute) * 60_000).toISOString();
const updated_at = at(0);
const busy = 'Chief of Staff channel: Digest session is not idle';
const chat = {
	id: 'chatcos234',
	title: 'Hub chat with Chief of Staff',
	kind: 'plan',
	status: 'open' as const,
	agent: 'cos',
	updated_at,
	notes_log: [
		{ at: at(1), text: formatHubMessageNote('chatcos234-1a2b3c4d', { kind: 'cos' }, 'Ship it') },
		{
			at: at(2),
			text: formatHubDeliveredNote(
				'chatcos234-1a2b3c4d',
				'chief-of-staff-channel',
				'hub_message|chatcos234-1a2b3c4d'
			)
		},
		{ at: at(3), text: formatHubReplyNote('chatcos234-1a2b3c4d', 'Shipping now.') },
		{ at: at(4), text: formatHubMessageNote('chatcos234-5e6f7a8b', { kind: 'cos' }, 'And docs') },
		{ at: at(5), text: formatHubWaitingNote('chatcos234-5e6f7a8b', busy) }
	]
};
const chiefWork = {
	id: 'cosworkabc',
	title: 'Chief of Staff work',
	status: 'in_progress' as const,
	agent: 'cos',
	updated_at,
	notes_log: [{ at: at(5), text: 'An ordinary progress note' }]
};
const mine = {
	id: 'minework23',
	title: 'A session Daniel talks to',
	status: 'in_progress' as const,
	agent: 'mine',
	updated_at,
	notes_log: [
		{
			at: at(6),
			text: formatHubMessageNote(
				'minework23-99999999',
				{ kind: 'run', node: 'mb2', runId: 104 },
				'Rebase first'
			)
		}
	]
};
const runs = [{ id: 104, node: 'mb2', item_id: 'minework23', state: 'running', ended_at: null }];

function home() {
	const snapshot = buildHomeSnapshot(
		{ items: [chat, chiefWork, mine], runs, machines: [] },
		noProviders,
		now
	);
	return { ...snapshot, agents: listHomeAgents(snapshot.agents, ['mine']).agents };
}

test("Chief of Staff's thread is its Hub chat, with each message's receipt and keyed reply", () => {
	const chief = home().agents.find((agent) => agent.id === 'cos');
	expect(chief?.messages).toEqual([
		expect.objectContaining({
			from: 'you',
			text: 'Ship it',
			messageId: 'chatcos234-1a2b3c4d',
			status: 'acknowledged'
		}),
		expect.objectContaining({
			from: 'agent',
			text: 'Shipping now.',
			replyTo: 'chatcos234-1a2b3c4d'
		}),
		expect.objectContaining({ from: 'you', text: 'And docs', status: 'stored', reason: busy })
	]);
	const [answered, , waiting] = chief!.messages;
	expect(messageStatusText(answered, 'Chief of Staff')).toBe('Replied');
	expect(messageStatusText(waiting, 'Chief of Staff')).toBe(`Not delivered yet: ${busy}`);
	expect(messageStatusText({ status: 'stored' }, 'Chief of Staff')).toBe('Stored in Tracker');
	const sent = { id: 'send-1', status: 'sent' as const };
	const toChief = { ...message({}), kind: 'message' as const };
	expect(composerFeedback(toChief, sent, 'Chief of Staff')).toBe(
		'Stored in Tracker; it goes to Chief of Staff through its Tracker channel.'
	);
	const toRun = { ...toChief, agentId: 'mine', itemId: 'minework23', runId: 'mb2#104' };
	expect(composerFeedback(toRun, sent, 'mine')).toBe(
		'Stored in Tracker; it goes to mine at its next empty prompt.'
	);
	expect(
		messageStatusText(
			{ status: 'refused', reason: 'Chief of Staff channel not configured' },
			'Chief of Staff'
		)
	).toBe('Not delivered: Chief of Staff channel not configured');
});

test("a session's thread names its live run, the only place its messages may go", () => {
	const session = home().agents.find((agent) => agent.id === 'mine');
	expect(session).toMatchObject({ itemId: 'minework23', runId: 'mb2#104' });
	expect(session?.messages).toEqual([
		expect.objectContaining({ from: 'you', text: 'Rebase first', status: 'stored' })
	]);
});

function recorder(status: number, json: object) {
	const calls: { url: string; body: unknown }[] = [];
	const fetcher = (async (url: string, init: RequestInit) => {
		calls.push({ url, body: JSON.parse(String(init.body)) });
		return Response.json(json, { status });
	}) as unknown as typeof fetch;
	return { calls, fetcher };
}

const message = (extra: Partial<HomeChatInput>): HomeChatInput => ({
	id: '1a2b3c4d-0000-4000-8000-000000000001',
	agentId: 'cos',
	itemId: 'cos',
	kind: 'message',
	question: null,
	text: 'Ship it',
	...extra
});

test('a Hub message is stored by the Tracker for Chief of Staff or for one exact run', async () => {
	expect(homeChatInput.safeParse(message({})).success).toBe(true);
	expect(homeChatInput.safeParse(message({ agentId: 'mine', itemId: 'minework23' })).success).toBe(
		false
	);
	const cos = recorder(201, { id: 'chatcos234-1a2b3c4d', item: 'chatcos234', status: 'stored' });
	expect(await deliverHomeChat(message({}), home(), cos.fetcher)).toEqual({
		id: message({}).id,
		status: 'sent',
		messageId: 'chatcos234-1a2b3c4d'
	});
	expect(cos.calls).toEqual([
		{
			url: 'http://127.0.0.1:7701/messages',
			body: { id: message({}).id, target: 'cos', text: 'Ship it' }
		}
	]);

	const session = message({ agentId: 'mine', itemId: 'minework23', runId: 'mb2#104' });
	const run = recorder(201, { id: 'minework23-1a2b3c4d', item: 'minework23', status: 'stored' });
	expect((await deliverHomeChat(session, home(), run.fetcher)).status).toBe('sent');
	expect(run.calls[0].body).toEqual({
		id: session.id,
		target: { item: 'minework23', node: 'mb2', run: 104 },
		text: 'Ship it'
	});

	// A run this computer no longer shows live is refused here; the Tracker refuses an ended one.
	const stale = recorder(201, {});
	expect(
		(await deliverHomeChat({ ...session, runId: 'mb2#103' }, home(), stale.fetcher)).status
	).toBe('refused');
	expect(stale.calls).toEqual([]);
	const ended = recorder(409, { status: 'refused' });
	expect((await deliverHomeChat(session, home(), ended.fetcher)).status).toBe('refused');
});

test('attaches bounded item context without changing ordinary messages', () => {
	expect(homeChatItemSuffix()).toBe('');
	expect(homeChatItemSuffix({ id: 'routine-42', title: 'Deploy check', details: 'Saturday' })).toBe(
		'\n\nAttached Hub item: Deploy check (routine-42)\nSaturday'
	);
	expect(
		homeChatItemSuffix({ id: 'i'.repeat(500), title: 't'.repeat(500), details: 'd'.repeat(500) })
			.length
	).toBeLessThan(850);
});
