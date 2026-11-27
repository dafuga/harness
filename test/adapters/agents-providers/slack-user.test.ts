import { expect, test, vi } from 'vitest';
import { SlackUserAdapter } from '../../../src/lib/agents-providers/slackUser';

const binding = { workspaceId: 'T123', userId: 'U123' };
const auth = { ok: true, team_id: 'T123', user_id: 'U123', team: 'Test workspace', user: 'Sam' };
const channel = 'C123';
const ts = '1720000000.001';

test('a rotated user token is bound again before polling or posting', async () => {
	let token = 'xoxp-fixture';
	const fetch = vi.fn(async (url: string) => {
		if (url.endsWith('auth.test')) return Response.json(auth);
		if (new URL(url).pathname.startsWith('/api/conversations.'))
			return Response.json({ ok: true, messages: [{ ts, text: 'hello' }], has_more: true });
		return Response.json({ ok: true, channel, ts });
	});
	const adapter = new SlackUserAdapter({
		binding,
		withToken: (use) => use(token),
		allowsChannel: (id) => id === channel,
		fetch: fetch as unknown as typeof globalThis.fetch
	});
	expect(await adapter.read(channel)).toMatchObject({ messages: [{ ts }], hasMore: true });
	token = 'xoxe.xoxp-rotated-fixture';
	expect(await adapter.read(channel, { threadTs: ts })).toMatchObject({ messages: [{ ts }] });
	expect(await adapter.send(channel, 'reply', ts)).toEqual({ channelId: channel, messageId: ts });
	expect(fetch.mock.calls.map(([url]) => new URL(url).pathname.split('/').at(-1))).toEqual([
		'auth.test',
		'conversations.history',
		'auth.test',
		'conversations.replies',
		'chat.postMessage'
	]);
	expect(fetch).toHaveBeenNthCalledWith(
		2,
		expect.stringContaining('/api/conversations.history?channel=C123'),
		expect.objectContaining({ method: 'GET', body: undefined })
	);
	expect(fetch).toHaveBeenNthCalledWith(
		4,
		expect.stringContaining('/api/conversations.replies?channel=C123&ts=' + ts),
		expect.objectContaining({ method: 'GET', body: undefined })
	);
	expect(fetch).toHaveBeenLastCalledWith(
		expect.any(String),
		expect.objectContaining({
			body: expect.stringContaining('"thread_ts":"' + ts + '"')
		})
	);
});

test.each([
	{ token: 'xoxb-fixture', identity: auth, calls: 0, code: 'credential-unavailable' },
	{
		token: 'xoxp-fixture',
		identity: { ...auth, team_id: 'T999' },
		calls: 1,
		code: 'identity-mismatch'
	},
	{
		token: 'xoxp-fixture',
		identity: { ...auth, user_id: 'U999' },
		calls: 1,
		code: 'identity-mismatch'
	},
	{
		token: 'xoxp-fixture',
		identity: { ...auth, bot_id: 'B123' },
		calls: 1,
		code: 'identity-mismatch'
	}
])('rejects a grant with $code before sending', async ({ token, identity, calls, code }) => {
	const fetch = vi.fn(async () => Response.json(identity));
	const adapter = new SlackUserAdapter({
		binding,
		withToken: (use) => use(token),
		allowsChannel: () => true,
		fetch: fetch as unknown as typeof globalThis.fetch
	});
	await expect(adapter.send(channel, 'message')).rejects.toMatchObject({ code });
	expect(fetch).toHaveBeenCalledTimes(calls);
});

test('a missing write receipt is ambiguous and the send is never replayed', async () => {
	const fetch = vi.fn(async (url: string) => {
		if (url.endsWith('auth.test')) return Response.json(auth);
		throw new Error('dropped response');
	});
	const adapter = new SlackUserAdapter({
		binding,
		withToken: (use) => use('xoxp-fixture'),
		allowsChannel: () => true,
		fetch: fetch as unknown as typeof globalThis.fetch
	});
	await expect(adapter.send(channel, 'message')).rejects.toMatchObject({
		code: 'delivery-unknown'
	});
	expect(fetch).toHaveBeenCalledTimes(2);
});
