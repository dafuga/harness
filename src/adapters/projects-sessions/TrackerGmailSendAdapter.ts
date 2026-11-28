// @harness-uid u_nchu7tvx63
import { z } from 'zod';
import type {
	TrackerOutgoingMessage,
	TrackerOutgoingResult
} from '../../repositories/projects-sessions/TrackerOutgoingDraftRepository.types';
import type {
	TrackerGmailReply,
	TrackerGmailSendAdapterConfig,
	GmailRequest
} from './TrackerGmailSendAdapter.types';
import {
	gmailDraftMime,
	gmailNativeId,
	gmailReply
} from './tracker-gmail-send-adapter/gmailDraftMime';

const threadMetadata = z.object({
	messages: z.array(
		z.object({
			threadId: z.string(),
			payload: z.object({
				headers: z.array(z.object({ name: z.string(), value: z.string() }))
			})
		})
	)
});
const receipt = z.object({
	id: z.string().refine(gmailNativeId),
	threadId: z.string().refine(gmailNativeId)
});
const refused = new Set([400, 401, 403, 404, 429]);

/** Delivers one reviewed Gmail draft with a token limited to the configured sender. */
export class TrackerGmailSendAdapter {
	constructor(private readonly config: TrackerGmailSendAdapterConfig) {}

	async send(message: TrackerOutgoingMessage, attempt: string): Promise<TrackerOutgoingResult> {
		if (!this.matchesAccount(message) || !z.uuid().safeParse(attempt).success)
			return { kind: 'failed' };
		const signal = AbortSignal.timeout(12_000);
		const account = encodeURIComponent(this.config.account);
		const root = 'https://gmail.googleapis.com/gmail/v1/users/' + account;
		let submitting = false;
		try {
			const token = (await this.config.readAccessToken(signal)).trim();
			if (!/^[A-Za-z0-9._~-]{1,4096}$/.test(token)) return { kind: 'failed' };
			const headers = { authorization: 'Bearer ' + token, 'content-type': 'application/json' };
			const reply = await this.readReply(message, { root, headers, signal });
			if (message.thread && !reply) return { kind: 'failed' };
			const payload = {
				raw: gmailDraftMime(message, attempt, reply),
				threadId: message.thread?.id
			};
			submitting = true;
			return await this.deliver(payload, { root, headers, signal });
		} catch {
			return { kind: submitting ? 'unconfirmed' : 'failed' };
		}
	}

	private matchesAccount(message: TrackerOutgoingMessage) {
		return (
			message.channel === 'gmail' &&
			message.account === this.config.account &&
			[message.account, ...message.to, ...message.cc].every(
				(value) => z.email().safeParse(value).success
			) &&
			!/[\p{Cc}\u2028\u2029]/u.test(message.subject ?? '')
		);
	}

	private async readReply(
		{ thread, subject }: TrackerOutgoingMessage,
		{ root, headers, signal }: GmailRequest
	): Promise<TrackerGmailReply | undefined> {
		if (!thread || !gmailNativeId(thread.id)) return undefined;
		const query =
			'format=metadata&metadataHeaders=Message-ID&metadataHeaders=Subject&metadataHeaders=References';
		const response = await (this.config.fetcher ?? fetch)(
			root + '/threads/' + thread.id + '?' + query,
			{
				headers,
				signal,
				redirect: 'error'
			}
		);
		if (!response.ok) {
			await response.body?.cancel();
			return undefined;
		}
		const parsed = threadMetadata.parse(await response.json());
		const parent = parsed.messages.at(-1);
		return parent?.threadId === thread.id ? gmailReply(parent.payload.headers, subject) : undefined;
	}

	private async deliver(
		payload: { raw: string; threadId?: string },
		{ root, headers, signal }: GmailRequest
	): Promise<TrackerOutgoingResult> {
		const response = await (this.config.fetcher ?? fetch)(root + '/messages/send', {
			method: 'POST',
			headers,
			signal,
			body: JSON.stringify(payload),
			redirect: 'error'
		});
		if (!response.ok) {
			await response.body?.cancel();
			return { kind: refused.has(response.status) ? 'failed' : 'unconfirmed' };
		}
		const result = receipt.parse(await response.json());
		if (payload.threadId && result.threadId !== payload.threadId) return { kind: 'unconfirmed' };
		return {
			kind: 'sent',
			receipt: {
				reference: result.id,
				url: `https://mail.google.com/mail/u/${encodeURIComponent(this.config.account)}/#all/${result.threadId}`
			}
		};
	}
}

export type { TrackerGmailSendAdapterConfig } from './TrackerGmailSendAdapter.types';
