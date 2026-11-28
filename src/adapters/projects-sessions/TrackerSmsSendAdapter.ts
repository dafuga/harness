// @harness-uid u_bng5whqki7
import { z } from 'zod';
import type {
	TrackerOutgoingMessage,
	TrackerOutgoingResult
} from '../../repositories/projects-sessions/TrackerOutgoingDraftRepository.types';
import type { TrackerSmsSendAdapterConfig } from './TrackerSmsSendAdapter.types';

const receipt = z.object({
	account_sid: z.string(),
	from: z.string(),
	to: z.string(),
	sid: z.string().regex(/^SM[0-9a-f]{32}$/i),
	status: z.enum(['accepted', 'queued', 'sending', 'sent', 'delivered', 'failed', 'undelivered'])
});
const refused = new Set([400, 401, 403, 404, 422, 429]);

/** Submits reviewed SMS through the dedicated Twilio sender and records provider acceptance. */
export class TrackerSmsSendAdapter {
	constructor(private readonly config: TrackerSmsSendAdapterConfig) {}

	matches(message: TrackerOutgoingMessage): boolean {
		return (
			message.channel === 'sms' &&
			message.account === this.config.from &&
			message.to.length === 1 &&
			this.config.destinations.includes(message.to[0]) &&
			!message.thread &&
			message.body.length <= 1600
		);
	}

	async send(message: TrackerOutgoingMessage): Promise<TrackerOutgoingResult> {
		if (!this.matches(message)) return { kind: 'failed' };
		const { accountSid, from, keySid, readKeySecret, fetcher = fetch } = this.config;
		const signal = AbortSignal.timeout(12_000);
		let submitting = false;
		try {
			const secret = await readKeySecret(signal);
			if (!/^[A-Za-z0-9_-]{1,4096}$/.test(secret)) return { kind: 'failed' };
			const token = Buffer.from(keySid + ':' + secret).toString('base64');
			const to = message.to[0];
			submitting = true;
			const response = await fetcher(
				`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
				{
					method: 'POST',
					redirect: 'error',
					signal,
					headers: {
						authorization: 'Basic ' + token,
						'content-type': 'application/x-www-form-urlencoded'
					},
					body: new URLSearchParams({ From: from, To: to, Body: message.body })
				}
			);
			return await this.result(response, to);
		} catch {
			return { kind: submitting ? 'unconfirmed' : 'failed' };
		}
	}

	private async result(response: Response, to: string): Promise<TrackerOutgoingResult> {
		if (response.status !== 201) {
			await response.body?.cancel();
			return { kind: refused.has(response.status) ? 'failed' : 'unconfirmed' };
		}
		const result = receipt.parse(await response.json());
		if (
			result.account_sid !== this.config.accountSid ||
			result.from !== this.config.from ||
			result.to !== to
		)
			return { kind: 'unconfirmed' };
		if (result.status === 'failed' || result.status === 'undelivered') return { kind: 'failed' };
		return { kind: 'sent', receipt: { reference: result.sid } };
	}
}

export type { TrackerSmsSendAdapterConfig } from './TrackerSmsSendAdapter.types';
