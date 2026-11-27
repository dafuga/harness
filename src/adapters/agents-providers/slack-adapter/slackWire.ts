// @harness-uid u_cc6eqlqdar
import { z } from 'zod';
import type { PlatformMessage } from '../../../core/agents-providers/platformAdapter.types';

export const slackTimestamp = z.string().regex(/^\d{1,20}\.\d{1,9}$/);
// Public, private and direct-message conversations; the binding's allowlist still decides.
export const channelId = z.string().regex(/^[CGD][A-Z0-9]{1,63}$/);
export const teamId = z.string().regex(/^T[A-Z0-9]{1,63}$/);
export const appId = z.string().regex(/^A[A-Z0-9]{1,63}$/);
export const botId = z.string().regex(/^B[A-Z0-9]{1,63}$/);
export const userId = z.string().regex(/^[UW][A-Z0-9]{1,63}$/);

export const authReply = z.object({
	ok: z.literal(true),
	team_id: teamId,
	bot_id: botId,
	user_id: userId
});

export const postReply = z.object({
	ok: z.literal(true),
	channel: channelId,
	ts: slackTimestamp
});

const allowedMessage = z.object({
	channelId,
	text: z
		.string()
		.max(4000)
		.refine((text) => text.trim().length > 0),
	threadId: slackTimestamp.optional(),
	blocks: z.array(z.record(z.string(), z.unknown())).min(1).max(50).optional()
});

export const socketAddress = z.object({ ok: z.literal(true), url: z.string().max(2048) });
export const envelope = z.object({
	type: z.string(),
	envelope_id: z
		.string()
		.regex(/^[A-Za-z0-9_-]{1,128}$/)
		.optional(),
	payload: z.unknown()
});

export const callback = z.object({
	team_id: teamId,
	api_app_id: appId,
	event_id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
	is_ext_shared_channel: z.literal(false).optional(),
	type: z.literal('event_callback'),
	event: z.object({
		type: z.enum(['message', 'app_mention']),
		user: userId,
		channel: channelId,
		channel_type: z.string().optional(),
		text: z.string().max(40000),
		ts: slackTimestamp,
		thread_ts: slackTimestamp.optional(),
		team: teamId.optional(),
		user_team: teamId.optional(),
		source_team: teamId.optional(),
		bot_id: z.undefined().optional(),
		app_id: z.undefined().optional(),
		subtype: z.undefined().optional(),
		hidden: z.literal(false).optional()
	})
});

/** Snapshot the caller's render data before the message can wait in the send queue. */
export function parseSlackMessage(input: PlatformMessage): PlatformMessage | undefined {
	const parsed = allowedMessage.safeParse(input);
	if (!parsed.success) return undefined;
	const { blocks } = parsed.data;
	if (!blocks) return parsed.data;
	try {
		const encoded = JSON.stringify(blocks);
		if (Buffer.byteLength(encoded) > 50_000) return undefined;
		return { ...parsed.data, blocks: JSON.parse(encoded) };
	} catch {
		return undefined;
	}
}
