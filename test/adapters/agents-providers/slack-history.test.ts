import { expect, test } from 'vitest';
import { SlackHistoryAdapter } from '../../../src/adapters/agents-providers/SlackHistoryAdapter';

function slack(...replies: (object | number)[]) {
	const calls: string[] = [];
	const waits: number[] = [];
	const adapter = new SlackHistoryAdapter({
		workspaceId: 'T1',
		token: async () => 'test-token',
		sleep: async (ms) => void waits.push(ms),
		fetch: (async (url: URL) => {
			calls.push(String(url));
			const next = replies.shift() ?? 500;
			return typeof next === 'number'
				? new Response('', { status: next, headers: { 'retry-after': '7' } })
				: Response.json(next);
		}) as unknown as typeof fetch
	});
	return { adapter, calls, waits };
}

test('SlackHistoryAdapter follows pages and waits out a rate limit', async () => {
	const row = (ts: string) => ({ ts, bot_id: 'B1', reply_count: 1, latest_reply: '3.000001' });
	const { adapter, calls, waits } = slack(
		429,
		{ ok: true, messages: [row('1.000001')], response_metadata: { next_cursor: 'next' } },
		{ ok: true, messages: [row('2.000001')] }
	);
	const messages = await adapter.history('C1', '0');
	expect(messages.map((message) => message.ts)).toEqual(['1.000001', '2.000001']);
	expect(messages[0]).toMatchObject({ botId: 'B1', replyCount: 1, latestReply: '3.000001' });
	expect(waits).toEqual([7000]);
	expect(calls[2]).toContain('cursor=next');
});

test('SlackHistoryAdapter refuses another workspace and reports only Slack codes', async () => {
	const other = slack({ ok: true, team_id: 'T2', url: 'https://other.slack.com/' });
	await expect(other.adapter.identity()).rejects.toThrow('different workspace');
	const refused = slack({ ok: false, error: 'missing_scope' });
	await expect(refused.adapter.replies('C1', '1.000001')).rejects.toThrow(
		'Slack conversations.replies refused: missing_scope.'
	);
	const gone = slack({ ok: false, error: 'thread_not_found' });
	await expect(gone.adapter.replies('C1', '1.000001')).resolves.toEqual([]);
});
