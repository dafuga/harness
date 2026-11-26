// @harness-uid u_ecwwjokmiv
import { z } from 'zod';
import type { QaSlackMessage } from '../../../core/agents-providers/qaSync.types';
import type { UntrustedValue } from '../../../core/agents-providers/projectAssistant.types';

const timestamp = z.string().regex(/^\d{1,16}\.\d{1,9}$/);
const message = z.object({
	ts: timestamp,
	text: z.string().default(''),
	user: z.string().optional(),
	bot_id: z.string().optional(),
	subtype: z.string().optional(),
	reply_count: z.number().optional(),
	latest_reply: timestamp.optional(),
	reactions: z
		.array(z.object({ name: z.string(), count: z.number(), users: z.array(z.string()) }))
		.optional()
});

/** @pure Decode Slack message rows; an unreadable page fails instead of losing replies. */
export function slackMessages(value: UntrustedValue): QaSlackMessage[] {
	return z
		.array(message)
		.parse(value)
		.map(({ bot_id, reply_count, latest_reply, ...row }) => ({
			...row,
			botId: bot_id,
			replyCount: reply_count,
			latestReply: latest_reply
		}));
}
