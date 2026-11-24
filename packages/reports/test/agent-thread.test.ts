import { expect, test } from 'vitest';
import {
	deliverToAgent,
	entryLabel,
	openThread,
	recordAgentReply,
	recordTrackerNote,
	scopeRefusal
} from '../src/lib/projects-sessions/hub-home/agentThread';
import type {
	AgentThread,
	AgentThreadScope
} from '../src/lib/projects-sessions/hub-home/agentThread.types';

const bound: AgentThreadScope = {
	accountId: 'acct-a',
	projectId: 'proj-1',
	sessionId: 'cos',
	runId: 'run-7'
};
const at = '2026-11-24T10:00:00.000Z';

function openWithDelivery(): AgentThread {
	const opened = deliverToAgent(openThread(bound), bound, { id: 'm1', text: 'status?', at });
	if (!opened.ok) throw new Error('setup delivery refused');
	return opened.thread;
}

test('a posted Tracker note is recorded without being a delivery or a reply', () => {
	const result = recordTrackerNote(openThread(bound), { id: 'n1', text: 'note', at });
	expect(result.ok).toBe(true);
	if (!result.ok) return;
	expect(result.thread.entries.map((entry) => entry.kind)).toEqual(['tracker-note']);
	expect(result.thread.entries[0]?.refId).toBeNull();
});

test('delivery to the bound live run is recorded as delivered, separate from a note', () => {
	const result = deliverToAgent(openThread(bound), bound, { id: 'm1', text: 'status?', at });
	expect(result.ok).toBe(true);
	if (!result.ok) return;
	expect(result.thread.entries[0]?.kind).toBe('delivered');
});

test('an agent reply is accepted only for a delivered message in the same thread', () => {
	const thread = openWithDelivery();
	const reply = recordAgentReply(thread, bound, { id: 'r1', refId: 'm1', text: 'ok', at });
	expect(reply.ok).toBe(true);
	if (!reply.ok) return;
	expect(reply.thread.entries.map((entry) => entry.kind)).toEqual(['delivered', 'agent-reply']);
	expect(reply.thread.entries[1]?.refId).toBe('m1');
});

test('a reply to an unknown or tracker-note id is refused', () => {
	const thread = openWithDelivery();
	expect(recordAgentReply(thread, bound, { id: 'r2', refId: 'nope', text: 'x', at })).toEqual({
		ok: false,
		reason: 'unknown-delivery'
	});
	const noted = recordTrackerNote(openThread(bound), { id: 'n1', text: 'note', at });
	if (!noted.ok) throw new Error('setup note refused');
	expect(recordAgentReply(noted.thread, bound, { id: 'r3', refId: 'n1', text: 'x', at })).toEqual({
		ok: false,
		reason: 'unknown-delivery'
	});
});

test('duplicate entry ids are refused', () => {
	const thread = openWithDelivery();
	expect(deliverToAgent(thread, bound, { id: 'm1', text: 'again', at })).toEqual({
		ok: false,
		reason: 'duplicate-id'
	});
});

test('another account, project or session never receives a delivery', () => {
	const thread = openThread(bound);
	const cases: [Partial<AgentThreadScope>, string][] = [
		[{ accountId: 'acct-b' }, 'other-account'],
		[{ projectId: 'proj-2' }, 'other-project'],
		[{ sessionId: 'worker' }, 'other-session']
	];
	for (const [override, reason] of cases) {
		const live = { ...bound, ...override };
		expect(deliverToAgent(thread, live, { id: 'x', text: 'hi', at })).toEqual({
			ok: false,
			reason
		});
	}
});

test('a replaced run never receives a delivery and its replies are refused', () => {
	const thread = openWithDelivery();
	const replaced = { ...bound, runId: 'run-8' };
	expect(deliverToAgent(thread, replaced, { id: 'm2', text: 'hi', at })).toEqual({
		ok: false,
		reason: 'replaced-run'
	});
	expect(recordAgentReply(thread, replaced, { id: 'r9', refId: 'm1', text: 'stale', at })).toEqual({
		ok: false,
		reason: 'replaced-run'
	});
});

test('scope refusal names the first mismatching identity, account before run', () => {
	expect(scopeRefusal(bound, { ...bound, accountId: 'x', runId: 'y' })).toBe('other-account');
	expect(scopeRefusal(bound, bound)).toBeNull();
});

test('each thread kind has its own label', () => {
	const labels = new Set([
		entryLabel('tracker-note'),
		entryLabel('delivered'),
		entryLabel('agent-reply')
	]);
	expect(labels.size).toBe(3);
});
