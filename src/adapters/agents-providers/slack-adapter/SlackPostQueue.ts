// @harness-uid u_en7dmd2rv7
import { setTimeout as pause } from 'node:timers/promises';
import type {
	PlatformAuditDetail,
	PlatformMessage,
	PlatformReceipt,
	PlatformSendResult
} from '../../../core/agents-providers/platformAdapter.types';
import { SlackRequestError } from './SlackRequestError';

const maxQueueSize = 64;
const maxAttempts = 3;
const minimumChannelIntervalMs = 1000;
const maxRetryWaitMs = 10_000;

/** One active request per installation, with a channel interval and workspace cooldown. */
export class SlackPostQueue {
	private tail = Promise.resolve();
	private pending = 0;
	private workspaceReadyAt = 0;
	private readonly channelReadyAt = new Map<string, number>();

	constructor(
		private readonly post: (message: PlatformMessage) => Promise<PlatformReceipt>,
		private readonly audit: (detail: PlatformAuditDetail) => Promise<void>
	) {}

	send(message: PlatformMessage, requestId: string): Promise<PlatformSendResult> {
		if (this.pending >= maxQueueSize)
			return Promise.resolve(refusedSend(requestId, new SlackRequestError('busy')));
		this.pending++;
		const task = this.tail.then(() => this.deliver(message, requestId));
		this.tail = task.then(
			() => {
				this.pending--;
			},
			() => {
				this.pending--;
			}
		);
		return task;
	}

	private async deliver(message: PlatformMessage, requestId: string): Promise<PlatformSendResult> {
		try {
			const receipt = await this.postWithRetry(message, requestId);
			return { status: 'sent', requestId, receipt, auditRecorded: true };
		} catch (error) {
			return refusedSend(
				requestId,
				error instanceof SlackRequestError ? error : new SlackRequestError('delivery-unknown')
			);
		}
	}

	private async postWithRetry(
		message: PlatformMessage,
		requestId: string
	): Promise<PlatformReceipt> {
		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			await this.waitUntilReady(message.channelId);
			this.channelReadyAt.set(message.channelId, Date.now() + minimumChannelIntervalMs);
			try {
				return await this.post(message);
			} catch (error) {
				if (!(error instanceof SlackRequestError) || error.code !== 'rate-limited') throw error;
				const retryAfterMs = error.retryAfterMs ?? minimumChannelIntervalMs;
				this.workspaceReadyAt = Date.now() + retryAfterMs;
				if (attempt === maxAttempts || retryAfterMs > maxRetryWaitMs) throw error;
				await this.audit({
					kind: 'send-retry',
					requestId,
					channelId: message.channelId,
					retryAfterMs
				});
			}
		}
		throw new SlackRequestError('rate-limited');
	}

	private async waitUntilReady(channelId: string): Promise<void> {
		const wait =
			Math.max(this.workspaceReadyAt, this.channelReadyAt.get(channelId) ?? 0) - Date.now();
		if (wait > maxRetryWaitMs) throw new SlackRequestError('rate-limited', wait);
		if (wait > 0) await pause(wait);
	}
}

export function refusedSend(
	requestId: string,
	{ code, retryAfterMs }: SlackRequestError
): PlatformSendResult {
	return {
		status: code === 'delivery-unknown' ? 'unknown' : 'refused',
		code,
		...(retryAfterMs === undefined ? {} : { retryAfterMs }),
		requestId,
		auditRecorded: true
	};
}
