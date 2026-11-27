// @harness-uid u_kvckdadbxo
import type {
	PlatformMessage,
	PlatformReceipt
} from '../../../core/agents-providers/platformAdapter.types';
import { SlackRequestError } from './SlackRequestError';
import { slackRequest } from './slackRequest';

export const slackConversationId = /^[CGD][A-Z0-9]{1,63}$/;
export const slackMessageTimestamp = /^\d{1,20}\.\d{1,9}$/;

export async function postSlackMessage(
	fetchImpl: typeof fetch,
	token: string,
	message: PlatformMessage,
	userGrant = false
): Promise<PlatformReceipt> {
	const raw = await slackRequest(fetchImpl, 'chat.postMessage', token, {
		userGrant,
		body: {
			channel: message.channelId,
			text: message.text,
			thread_ts: message.threadId,
			blocks: message.blocks,
			unfurl_links: false,
			unfurl_media: false,
			...(userGrant && { mrkdwn: false })
		}
	});
	const reply = raw as { ok?: boolean; channel?: unknown; ts?: unknown } | null;
	if (
		reply?.ok !== true ||
		reply.channel !== message.channelId ||
		typeof reply.ts !== 'string' ||
		!slackMessageTimestamp.test(reply.ts)
	)
		throw new SlackRequestError('delivery-unknown');
	return { channelId: reply.channel, messageId: reply.ts };
}
