import { afterEach, expect, test, vi } from 'vitest';
import { SlackAdapter } from '../src/adapters/agents-providers/SlackAdapter';
import { openSlackSocket } from '../src/adapters/agents-providers/slack-adapter/openSlackSocket';
import type { PlatformEvent } from '../src/core/agents-providers/platformAdapter.types';
import {
	appToken,
	auth,
	channel,
	installation,
	mockSlack,
	post,
	postedAt,
	slackFixture,
	socket,
	thread
} from './adapters/agents-providers/slack/slackFixture';

vi.mock('../src/adapters/agents-providers/slack-adapter/openSlackSocket', () => ({
	openSlackSocket: vi.fn()
}));

afterEach(() => {
	vi.unstubAllGlobals();
	vi.resetAllMocks();
});

function eventFrame(envelopeId: string, eventOverride = {}, callbackOverride = {}) {
	return JSON.stringify({
		type: 'events_api',
		envelope_id: envelopeId,
		payload: {
			team_id: installation.workspaceId,
			api_app_id: installation.appId,
			type: 'event_callback',
			event_id: 'EvFIXTURE',
			event: {
				type: 'message',
				user: 'UAUTHOR',
				channel,
				text: 'private message body',
				ts: postedAt,
				thread_ts: thread,
				...eventOverride
			},
			...callbackOverride
		}
	});
}

function fakeSocket(frames: string[], onAck?: (id: string) => void) {
	const connection = {
		frames: (async function* () {
			yield* frames;
		})(),
		ack: vi.fn(async (id: string) => {
			onAck?.(id);
		}),
		close: vi.fn()
	};
	vi.mocked(openSlackSocket).mockReturnValueOnce(connection);
	return connection;
}

function ignoredFrames(): string[] {
	return [
		eventFrame('wrong-channel', { channel: 'COTHER' }),
		eventFrame('self', { user: installation.botUserId }),
		eventFrame('bot', { bot_id: 'BOTHER' }),
		eventFrame('external', { user_team: 'TOTHER' }),
		eventFrame('shared', {}, { is_ext_shared_channel: true }),
		eventFrame('wrong-app', {}, { api_app_id: 'AOTHER' }),
		eventFrame('wrong-team', {}, { team_id: 'TOTHER' })
	];
}

test('delivers authorized human messages once, then acknowledges them and reconnects', async () => {
	const controller = new AbortController();
	const { config, audit, scopes } = slackFixture();
	const fetch = mockSlack(auth(), socket(), socket());
	const first = fakeSocket(
		[
			...ignoredFrames(),
			eventFrame('delivery'),
			JSON.stringify({ type: 'disconnect', reason: 'refresh_requested' })
		],
		(id) => {
			if (id === 'delivery') expect(audit.at(-1)).toMatchObject({ kind: 'receive-accepted' });
		}
	);
	const second = fakeSocket([eventFrame('duplicate')], () => controller.abort());
	const handler = vi.fn<(event: PlatformEvent) => Promise<void>>().mockResolvedValue();
	await new SlackAdapter(config).subscribe(handler, controller.signal);

	expect(handler).toHaveBeenCalledExactlyOnceWith(
		{
			id: 'EvFIXTURE',
			channelId: channel,
			senderId: 'UAUTHOR',
			text: 'private message body',
			messageId: postedAt,
			threadId: thread
		},
		controller.signal
	);
	expect(first.ack.mock.calls.flat()).toEqual([
		'wrong-channel',
		'self',
		'bot',
		'external',
		'shared',
		'wrong-app',
		'wrong-team',
		'delivery'
	]);
	expect(second.ack.mock.calls.flat()).toEqual(['duplicate']);
	expect(first.close).toHaveBeenCalledOnce();
	expect(second.close).toHaveBeenCalledOnce();
	expect(audit.map(({ kind }) => kind)).toEqual([
		'receive-attempt',
		'receive-accepted',
		'receive-reconnect'
	]);
	expect(JSON.stringify(audit)).not.toMatch(/private message body|synthetic-fixture/);
	expect(fetch.mock.calls[1]).toEqual([
		'https://slack.com/api/apps.connections.open',
		expect.objectContaining({
			headers: expect.objectContaining({ authorization: 'Bearer ' + appToken })
		})
	]);
	expect(scopes.map(({ purpose }) => purpose)).toEqual(['bot', 'socket', 'socket']);
});

test('retries rejected inbound events without acknowledging them and admits only mentions in mention mode', async () => {
	const controller = new AbortController();
	const { config } = slackFixture();
	mockSlack(auth(), socket(), socket());
	const mention = { type: 'app_mention' };
	const first = fakeSocket([eventFrame('plain'), eventFrame('failed', mention)]);
	const second = fakeSocket([eventFrame('retried', mention)], () => controller.abort());
	const handler = vi
		.fn<(event: PlatformEvent) => Promise<void>>()
		.mockRejectedValueOnce(new Error('internal failure'))
		.mockResolvedValueOnce();
	const adapter = new SlackAdapter({ ...config, receive: 'mentions' });

	await adapter.subscribe(handler, controller.signal);

	expect(handler).toHaveBeenCalledTimes(2);
	expect(first.ack.mock.calls.flat()).toEqual(['plain']);
	expect(second.ack.mock.calls.flat()).toEqual(['retried']);
	expect(first.close).toHaveBeenCalledOnce();
	expect(second.close).toHaveBeenCalledOnce();
});

test('refuses an untrusted socket address and supports abort during reconnect', async () => {
	const controller = new AbortController();
	const { config } = slackFixture();
	mockSlack(
		auth(),
		Response.json({
			ok: true,
			url: 'wss://wss.slack.com.other.test/link/?ticket=synthetic-fixture'
		})
	);
	const adapter = new SlackAdapter({
		...config,
		audit: async (entry) => {
			if (entry.kind === 'receive-reconnect') controller.abort();
		}
	});

	await expect(adapter.subscribe(vi.fn(), controller.signal)).resolves.toBeUndefined();
	expect(openSlackSocket).not.toHaveBeenCalled();
});

test('replies only within authenticated one-to-one direct-message threads', async () => {
	const controller = new AbortController();
	const { config } = slackFixture();
	mockSlack(auth(), socket(), post('DDIRECT'));
	const dm = { channel: 'DDIRECT', channel_type: 'im' };
	const adapter = new SlackAdapter({ ...config, receive: 'mentions', directMessages: true });
	const connection = fakeSocket(
		[
			eventFrame('missing-im-type', { channel: 'DDIRECT' }),
			eventFrame('outside-workspace', { ...dm, user_team: 'TOTHER' }),
			eventFrame('bot-message', { ...dm, bot_id: 'BOTHER' }),
			eventFrame('direct', dm)
		],
		(id) => {
			if (id === 'direct') controller.abort();
		}
	);
	const reply = { channelId: 'DDIRECT', threadId: thread, text: 'Scoped answer' };
	await expect(adapter.send(reply)).resolves.toMatchObject({ status: 'refused', code: 'denied' });
	const handler = vi.fn(async (event: PlatformEvent) => {
		expect(event).toMatchObject({ channelId: reply.channelId, threadId: reply.threadId });
		await expect(adapter.send({ ...reply, threadId: postedAt })).resolves.toMatchObject({
			status: 'refused',
			code: 'denied'
		});
		await expect(adapter.send(reply)).resolves.toMatchObject({ status: 'sent' });
	});
	await adapter.subscribe(handler, controller.signal);
	expect(handler).toHaveBeenCalledOnce();
	expect(connection.ack).toHaveBeenCalledTimes(4);
});
