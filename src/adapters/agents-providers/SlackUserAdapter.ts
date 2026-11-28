// @harness-uid u_6jngysfyen
import { createHash } from 'node:crypto';
import type { PlatformReceipt } from '../../core/agents-providers/platformAdapter.types';
import type {
	SlackUserAdapterConfig,
	SlackUserBinding,
	SlackUserConversationPage,
	SlackUserMessagePage
} from './SlackUserAdapter.types';
import { SlackRequestError } from './slack-adapter/SlackRequestError';
import { slackRequest } from './slack-adapter/slackRequest';
import {
	postSlackMessage,
	slackConversationId,
	slackMessageTimestamp
} from './slack-adapter/postSlackMessage';
import { decodeConversations, decodeHistory } from './slack-adapter/slackUserPages';

const validUser = /^[UW][A-Z0-9]{1,63}$/;
const validTeam = /^T[A-Z0-9]{1,63}$/;
const validToken = /^(xoxp|xoxe\.xoxp)-[a-zA-Z0-9-]+$/;

/** Slack Web API calls bound to a workspace member. The host owns send authorization. */
export class SlackUserAdapter {
	private verified?: { digest: string; workspace: string; user: string };
	private readonly binding: SlackUserBinding;
	private readonly fetch: typeof fetch;

	constructor(private readonly config: SlackUserAdapterConfig) {
		this.binding = { ...config.binding };
		if (!validTeam.test(this.binding.workspaceId) || !validUser.test(this.binding.userId))
			throw new SlackRequestError('denied');
		this.fetch = config.fetch ?? globalThis.fetch;
	}

	identity(): Promise<SlackUserBinding & { workspace: string; user: string }> {
		return this.use(async () => {
			const { workspace, user } = this.verified!;
			return { ...this.binding, workspace, user };
		});
	}

	conversations(types: string, cursor?: string): Promise<SlackUserConversationPage> {
		return this.use(async (token) =>
			decodeConversations(
				await slackRequest(this.fetch, 'users.conversations', token, {
					body: { types, limit: 100, exclude_archived: true, cursor },
					userGrant: true
				})
			)
		);
	}

	read(
		channel: string,
		options: { threadTs?: string; oldest?: string; cursor?: string } = {}
	): Promise<SlackUserMessagePage> {
		this.checkChannel(channel);
		const { threadTs, oldest, cursor } = options;
		if (threadTs && !slackMessageTimestamp.test(threadTs))
			throw new SlackRequestError('invalid-message');
		return this.use(async (token) => {
			this.checkChannel(channel);
			const method = threadTs ? 'conversations.replies' : 'conversations.history';
			return decodeHistory(
				await slackRequest(this.fetch, method, token, {
					body: { channel, ts: threadTs, oldest, cursor, limit: 15 },
					userGrant: true
				})
			);
		});
	}

	send(channel: string, text: string, threadTs?: string): Promise<PlatformReceipt> {
		this.checkChannel(channel);
		if (!text.trim() || text.length > 4000 || (threadTs && !slackMessageTimestamp.test(threadTs)))
			throw new SlackRequestError('invalid-message');
		return this.use((token) => {
			this.checkChannel(channel);
			return postSlackMessage(
				this.fetch,
				token,
				{ channelId: channel, text, threadId: threadTs },
				true
			);
		});
	}

	private checkChannel(channel: string): void {
		if (!slackConversationId.test(channel) || !this.config.allowsChannel(channel))
			throw new SlackRequestError('denied');
	}

	private use<T>(run: (token: string) => Promise<T>): Promise<T> {
		return this.config.withToken(async (token) => {
			if (!validToken.test(token)) throw new SlackRequestError('credential-unavailable');
			await this.verify(token);
			return run(token);
		});
	}

	private async verify(token: string): Promise<void> {
		const digest = createHash('sha256').update(token).digest('hex');
		if (this.verified?.digest === digest) return;
		const raw = await slackRequest(this.fetch, 'auth.test', token, { userGrant: true });
		const reply = raw as {
			ok?: boolean;
			team_id?: string;
			user_id?: string;
			bot_id?: string;
			team?: string;
			user?: string;
		} | null;
		if (
			reply?.ok !== true ||
			reply.bot_id ||
			reply.team_id !== this.binding.workspaceId ||
			reply.user_id !== this.binding.userId
		)
			throw new SlackRequestError('identity-mismatch');
		const label = (text: unknown, fallback: string) =>
			typeof text === 'string' && text.trim() ? text.slice(0, 120) : fallback;
		this.verified = {
			digest,
			workspace: label(reply.team, this.binding.workspaceId),
			user: label(reply.user, this.binding.userId)
		};
	}
}
