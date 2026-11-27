import { afterEach, expect, test, vi } from 'vitest';
import { AssistantSlackMediaAdapter } from '../../../src/adapters/agents-providers/AssistantSlackMediaAdapter';
import { auth, channel, mockSlack, slackFixture, thread } from './slack/slackFixture';

afterEach(() => vi.unstubAllGlobals());

test('uploads only to Slack, without forwarding the bot token, and attaches evidence to the parent', async () => {
	const { config } = slackFixture();
	const fetch = mockSlack(
		auth(),
		Response.json({
			ok: true,
			file_id: 'FVIDEO',
			upload_url: 'https://files.slack.com/upload/v1/ticket'
		}),
		new Response('OK'),
		Response.json({ ok: true })
	);
	const media = new AssistantSlackMediaAdapter(config);
	await expect(media.upload('COTHER', thread, new Uint8Array([1]), 'steps')).rejects.toMatchObject({
		code: 'denied'
	});
	expect(fetch).not.toHaveBeenCalled();
	await media.upload(channel, thread, new Uint8Array([1]), 'steps');
	expect(fetch.mock.calls.map(([url]) => String(url))).toEqual([
		'https://slack.com/api/auth.test',
		'https://slack.com/api/files.getUploadURLExternal',
		'https://files.slack.com/upload/v1/ticket',
		'https://slack.com/api/files.completeUploadExternal'
	]);
	const [, , upload, complete] = fetch.mock.calls;
	expect(new Headers(upload[1]?.headers).has('authorization')).toBe(false);
	expect(upload[1]?.redirect).toBe('error');
	expect(JSON.parse(String(complete[1]?.body))).toMatchObject({
		channel_id: channel,
		thread_ts: thread,
		initial_comment: 'steps',
		files: [{ id: 'FVIDEO' }]
	});
});

test('creates and replaces a canvas and grants only configured channels read access', async () => {
	const { config } = slackFixture();
	const fetch = mockSlack(
		auth(),
		Response.json({ ok: true, canvas_id: 'FCANVAS' }),
		Response.json({ ok: true }),
		Response.json({ ok: true })
	);
	const media = new AssistantSlackMediaAdapter(config);
	const id = await media.create('QA', '# Runbooks');
	await expect(media.share(id, ['COTHER'])).rejects.toMatchObject({ code: 'denied' });
	await media.share(id, [channel]);
	await media.replace(id, '# Updated');
	expect(fetch.mock.calls.slice(1).map(([, request]) => JSON.parse(String(request?.body)))).toEqual(
		[
			{ title: 'QA', document_content: { type: 'markdown', markdown: '# Runbooks' } },
			{ canvas_id: 'FCANVAS', access_level: 'read', channel_ids: [channel] },
			{
				canvas_id: 'FCANVAS',
				changes: [
					{ operation: 'replace', document_content: { type: 'markdown', markdown: '# Updated' } }
				]
			}
		]
	);
});
