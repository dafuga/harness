import { afterEach, expect, test, vi } from 'vitest';
import { SlackAdapter } from '../../../src/adapters/agents-providers/SlackAdapter';
import {
	auth,
	botToken,
	channel,
	installation,
	mockSlack,
	post,
	postedAt,
	privateChannel,
	slackFixture,
	thread
} from './slack/slackFixture';

afterEach(() => vi.unstubAllGlobals());

test('verifies identity once per credential and posts a threaded Block Kit message', async () => {
	const { config, audit, scopes } = slackFixture();
	const fetch = mockSlack(auth(), post());
	const adapter = new SlackAdapter(config);
	const blocks = [{ type: 'section', text: { type: 'plain_text', text: 'rendered' } }];

	await expect(adapter.identity()).resolves.toEqual({
		workspaceId: installation.workspaceId,
		botId: installation.botId,
		botUserId: installation.botUserId
	});
	const outcome = await adapter.send({
		channelId: channel,
		text: 'fallback',
		threadId: thread,
		blocks
	});
	expect(outcome).toEqual({
		status: 'sent',
		requestId: expect.any(String),
		receipt: { channelId: channel, messageId: postedAt },
		auditRecorded: true
	});
	if (outcome.status !== 'sent') throw new Error('Expected a posting receipt.');
	expect(fetch.mock.calls.map(([url]) => url)).toEqual([
		'https://slack.com/api/auth.test',
		'https://slack.com/api/chat.postMessage'
	]);
	expect(fetch.mock.calls[1][1]).toMatchObject({
		method: 'POST',
		redirect: 'error',
		headers: { authorization: 'Bearer ' + botToken }
	});
	expect(JSON.parse(String(fetch.mock.calls[1][1]?.body))).toEqual({
		channel,
		text: 'fallback',
		thread_ts: thread,
		blocks,
		unfurl_links: false,
		unfurl_media: false
	});
	expect(scopes).toEqual([
		{ ...installation, purpose: 'bot' },
		{ ...installation, purpose: 'bot' }
	]);
	expect(audit.map(({ kind }) => kind)).toEqual(['send-attempt', 'send-result']);
	expect(audit[0]).toMatchObject({
		platform: 'slack',
		channelId: channel,
		requestId: outcome.requestId
	});
	expect(JSON.stringify(audit)).not.toMatch(/fallback|rendered|synthetic-fixture/);
});

test('revalidates rotated credentials and refuses a bot from another workspace', async () => {
	const { config } = slackFixture();
	let token = botToken;
	config.vault.withToken = async (_scope, use) => use(token);
	const fetch = mockSlack(auth(), auth({ team_id: 'TOTHER' }));
	const adapter = new SlackAdapter(config);
	await adapter.identity();
	token = 'xoxb-synthetic-rotated';

	await expect(adapter.send({ channelId: channel, text: 'test' })).resolves.toMatchObject({
		status: 'refused',
		code: 'identity-mismatch'
	});
	expect(fetch.mock.calls.map(([url]) => url)).toEqual([
		'https://slack.com/api/auth.test',
		'https://slack.com/api/auth.test'
	]);
});

test('refuses invalid payloads and unapproved channels before acquiring credentials', async () => {
	const { config, scopes } = slackFixture();
	const fetch = mockSlack();
	const adapter = new SlackAdapter(config);
	await expect(adapter.send({ channelId: 'COTHER', text: 'test' })).resolves.toMatchObject({
		status: 'refused',
		code: 'denied'
	});
	await expect(
		adapter.send({ channelId: channel, text: ' ', threadId: 'invalid' })
	).resolves.toMatchObject({
		status: 'refused',
		code: 'invalid-message'
	});
	expect(scopes).toEqual([]);
	expect(fetch).not.toHaveBeenCalled();
});

test('honors the workspace rate limit and retries an explicitly rejected send', async () => {
	const { config, audit } = slackFixture();
	const fetch = mockSlack(
		auth(),
		new Response(null, { status: 429, headers: { 'retry-after': '1' } }),
		post()
	);
	const adapter = new SlackAdapter(config);
	const started = Date.now();

	await expect(adapter.send({ channelId: channel, text: 'test' })).resolves.toMatchObject({
		status: 'sent'
	});
	expect(Date.now() - started).toBeGreaterThanOrEqual(1000);
	expect(fetch).toHaveBeenCalledTimes(3);
	expect(audit.map(({ kind }) => kind)).toEqual(['send-attempt', 'send-retry', 'send-result']);
	expect(audit[1]).toMatchObject({ retryAfterMs: 1000 });
});

test('retains a long workspace cooldown and avoids retrying unknown delivery', async () => {
	const throttled = new SlackAdapter(slackFixture().config);
	const fetch = mockSlack(
		auth(),
		new Response(null, { status: 429, headers: { 'retry-after': '45' } })
	);
	await expect(throttled.send({ channelId: channel, text: 'first' })).resolves.toMatchObject({
		status: 'refused',
		code: 'rate-limited',
		retryAfterMs: 45000
	});
	await expect(
		throttled.send({ channelId: privateChannel, text: 'second' })
	).resolves.toMatchObject({
		status: 'refused',
		code: 'rate-limited'
	});
	expect(fetch).toHaveBeenCalledTimes(2);

	const ambiguous = new SlackAdapter(slackFixture().config);
	const otherFetch = mockSlack(auth(), new Response(null, { status: 503 }));
	await expect(ambiguous.send({ channelId: channel, text: 'third' })).resolves.toMatchObject({
		status: 'unknown',
		code: 'delivery-unknown'
	});
	expect(otherFetch).toHaveBeenCalledTimes(2);
});

test('halts before unaudited sends and retains a receipt if result audit fails', async () => {
	const { config } = slackFixture();
	const unavailable = async () => {
		throw new Error('private infrastructure failure');
	};
	const fetch = mockSlack(auth(), post());
	const denied = new SlackAdapter({ ...config, audit: unavailable });
	await expect(denied.send({ channelId: channel, text: 'test' })).resolves.toMatchObject({
		status: 'refused',
		code: 'audit-unavailable',
		auditRecorded: false
	});
	expect(fetch).not.toHaveBeenCalled();

	const adapter = new SlackAdapter({
		...config,
		audit: async (entry) => {
			if (entry.kind === 'send-result') await unavailable();
		}
	});
	await expect(adapter.send({ channelId: channel, text: 'test' })).resolves.toMatchObject({
		status: 'sent',
		receipt: { channelId: channel, messageId: postedAt },
		auditRecorded: false
	});
});
