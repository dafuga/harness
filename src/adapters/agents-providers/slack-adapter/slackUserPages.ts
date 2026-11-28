// @harness-uid u_bpuzjjhas3
import type { UntrustedValue } from '../../../core/agents-providers/projectAssistant.types';
import type { SlackUserConversationPage, SlackUserMessagePage } from '../SlackUserAdapter.types';
import { SlackRequestError } from './SlackRequestError';
import { slackConversationId, slackMessageTimestamp } from './postSlackMessage';

const invalid = () => new SlackRequestError('provider-unavailable');
const record = (value: unknown) =>
	(value && typeof value === 'object' ? value : {}) as Record<string, unknown>;

function page(raw: unknown, key: string) {
	const reply = record(raw);
	const rows = reply[key];
	if (reply.ok !== true || !Array.isArray(rows) || rows.length > 100) throw invalid();
	const cursor = record(reply.response_metadata).next_cursor;
	return {
		rows: rows.map(record),
		nextCursor: typeof cursor === 'string' && cursor ? cursor : null,
		hasMore: reply.has_more === true
	};
}

export function decodeConversations(raw: UntrustedValue): SlackUserConversationPage {
	const { rows, nextCursor } = page(raw, 'channels');
	const conversations = rows.flatMap(({ id, name, is_ext_shared, is_im, is_mpim }) => {
		if (typeof id !== 'string' || !slackConversationId.test(id) || is_ext_shared === true)
			return [];
		const fallback = conversationType(is_im === true, is_mpim === true);
		return [{ id, name: typeof name === 'string' && name ? name.slice(0, 120) : fallback }];
	});
	return { conversations, nextCursor };
}

function conversationType(isDirect: boolean, isGroupDirect: boolean): string {
	if (isDirect) return 'Direct message';
	if (isGroupDirect) return 'Group message';
	return 'Conversation';
}

export function decodeHistory(raw: UntrustedValue): SlackUserMessagePage {
	const { rows, nextCursor, hasMore } = page(raw, 'messages');
	const messages = rows.map(({ ts, text, user, thread_ts }) => {
		if (typeof ts !== 'string' || !slackMessageTimestamp.test(ts)) throw invalid();
		return {
			ts,
			text: typeof text === 'string' ? text.slice(0, 4000) : '',
			...(typeof user === 'string' && { user }),
			...(typeof thread_ts === 'string' &&
				slackMessageTimestamp.test(thread_ts) && { threadTs: thread_ts })
		};
	});
	return { messages, nextCursor, hasMore };
}
