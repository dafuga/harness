import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { xDigestAsk } from '../../../src/workflows/agents-providers/run-x-digest/xDigestAsk';
import { fetchOutbox } from '../../../src/workflows/agents-providers/run-x-digest-send/fetchOutbox';
import { secretManagerToken } from '../../../src/workflows/agents-providers/run-x-digest-send/secretManagerToken';
import { slackWhoAmI } from '../../../src/workflows/agents-providers/run-x-digest-send/slackWhoAmI';
import { xDigestSlack } from '../../../src/workflows/agents-providers/run-x-digest-send/xDigestSlack';
import { createTempDirectory } from '../../support/temporary';
import { senderConfig } from '../../support/xDigestConfig';

afterEach(() => vi.unstubAllGlobals());

test('a question reaches the tracker with choices and a recommendation', async () => {
	const calls: string[][] = [];
	await xDigestAsk(
		{ item: 'abc123', command: 'tracker' },
		async (_command, args) => void calls.push(args)
	)('Sign in?');
	expect(calls[0].slice(0, 3)).toEqual(['flag', 'abc123', 'Sign in?']);
	expect(calls[0].filter((arg) => arg === '--option')).toHaveLength(2);
	expect(calls[0]).toContain('--recommend');
});

test('the outbox is fetched with a fixed read over ssh; a failure means wait', async () => {
	const calls: [string, string[]][] = [];
	await fetchOutbox(senderConfig().source, '2026-11-27', async (command, args) => {
		calls.push([command, args]);
		return 'file';
	});
	expect(calls[0][0]).toBe('ssh');
	expect(calls[0][1].slice(-2)).toEqual([
		'collector',
		'cat -- .local/share/harness-x-digest/out/2026-11-27.json'
	]);
	await expect(
		fetchOutbox(senderConfig().source, 'd', async () => Promise.reject(new Error('255')))
	).resolves.toBeUndefined();
});

test('the token is read from Secret Manager and a failure repeats none of its output', async () => {
	const secret = senderConfig().slack.secret;
	await expect(secretManagerToken(secret, async () => 'xoxb-test-only\n')).resolves.toBe(
		'xoxb-test-only'
	);
	const failure = secretManagerToken(secret, async () =>
		Promise.reject(Object.assign(new Error('xoxb-leaked'), { stdout: 'xoxb-leaked' }))
	);
	await expect(failure).rejects.toThrow('Could not read bot-token with gcloud.');
	await expect(failure).rejects.not.toThrow('leaked');
});

test('auth.test yields only the bot’s non-secret ids', async () => {
	const reply = { ok: true, team_id: 'T1', bot_id: 'B1', user_id: 'U1', url: 'ignored' };
	const request = (async () => Response.json(reply)) as unknown as typeof fetch;
	await expect(slackWhoAmI('xoxb-test-only', request)).resolves.toEqual({
		workspaceId: 'T1',
		botId: 'B1',
		botUserId: 'U1'
	});
	const refused = (async () => Response.json({ ok: false })) as unknown as typeof fetch;
	await expect(slackWhoAmI('xoxb-test-only', refused)).rejects.toThrow('auth.test');
});

test('posts through the Slack adapter to the one DM, and a send-only bind cannot listen', async () => {
	const directory = await createTempDirectory('x-slack-');
	const posted: { channel?: string }[] = [];
	vi.stubGlobal('fetch', async (url: string, init: { body?: string }) => {
		if (url.endsWith('auth.test'))
			return Response.json({ ok: true, team_id: 'T1', bot_id: 'B1', user_id: 'U1' });
		posted.push(JSON.parse(init.body!));
		return Response.json({ ok: true, channel: 'D1', ts: '1.000001' });
	});
	const send = xDigestSlack(
		senderConfig().slack,
		join(directory, 'audit.ndjson'),
		async () => 'xoxb-test-only'
	);
	await expect(send('hello')).resolves.toMatchObject({ status: 'sent' });
	expect(posted).toEqual([expect.objectContaining({ channel: 'D1', text: 'hello' })]);
	await rm(directory, { recursive: true, force: true });
});
