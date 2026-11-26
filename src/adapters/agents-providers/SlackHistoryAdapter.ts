// @harness-uid u_ly3hxvctan
import { QaSyncError } from '../../core/agents-providers/QaSyncError';
import type { QaSlackMessage, QaSlackReader } from '../../core/agents-providers/qaSync.types';
import type { SlackHistoryAdapterConfig } from './SlackHistoryAdapter.types';
import { slackMessages } from './slack-history-adapter/slackMessages';
import { slackRead } from './slack-history-adapter/slackRead';

const maxPages = 20;

/** Read-only Slack channel polling. It never posts, reacts or opens a socket. */
export class SlackHistoryAdapter implements QaSlackReader {
	constructor(private readonly config: SlackHistoryAdapterConfig) {}

	async identity(): Promise<{ workspaceUrl: string }> {
		const reply = await slackRead(this.config, 'auth.test', {});
		if (reply.team_id !== this.config.workspaceId)
			throw new QaSyncError('The Slack token belongs to a different workspace.');
		if (typeof reply.url !== 'string' || !/^https:\/\/[a-z0-9-]+\.slack\.com\/$/.test(reply.url))
			throw new QaSyncError('Slack auth.test returned no workspace address.');
		return { workspaceUrl: reply.url };
	}

	history(channel: string, oldest: string): Promise<QaSlackMessage[]> {
		return this.pages('conversations.history', { channel, oldest });
	}

	replies(channel: string, parentTs: string): Promise<QaSlackMessage[]> {
		return this.pages('conversations.replies', { channel, ts: parentTs });
	}

	/** A partial read would advance cursors past unseen replies, so an overlong one fails. */
	private async pages(
		method: 'conversations.history' | 'conversations.replies',
		query: Record<string, string>
	): Promise<QaSlackMessage[]> {
		const messages: QaSlackMessage[] = [];
		let cursor = '';
		for (let page = 0; page < maxPages; page++) {
			const reply = await slackRead(this.config, method, {
				...query,
				limit: '200',
				...(cursor ? { cursor } : {})
			});
			if (reply.error === 'thread_not_found') return [];
			messages.push(...slackMessages(reply.messages));
			cursor = reply.response_metadata?.next_cursor ?? '';
			if (!cursor) return messages;
		}
		throw new QaSyncError(`Slack ${method} exceeded ${maxPages} pages; lower lookbackDays.`);
	}
}

export type { SlackHistoryAdapterConfig } from './SlackHistoryAdapter.types';
