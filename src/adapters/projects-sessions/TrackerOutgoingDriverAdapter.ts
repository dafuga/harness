// @harness-uid u_6x5aw74rep
import { z } from 'zod';
import type {
	TrackerOutgoingMessage,
	TrackerOutgoingResult
} from '../../repositories/projects-sessions/TrackerOutgoingDraftRepository.types';
import {
	controlledTrackerExecutable,
	runTrackerHostCommand
} from './tracker-host-process-adapter/trackerHostCommand';
import type { TrackerOutgoingDriverAdapterConfig } from './TrackerOutgoingDriverAdapter.types';

const outcome = z.discriminatedUnion('kind', [
	z.strictObject({ kind: z.literal('failed') }),
	z.strictObject({ kind: z.literal('unconfirmed') }),
	z.strictObject({
		kind: z.literal('sent'),
		receipt: z.strictObject({
			reference: z
				.string()
				.min(1)
				.max(256)
				.regex(/^[^\p{Cc}]+$/u),
			url: z
				.url({ protocol: /^https$/ })
				.max(2048)
				.optional()
		})
	})
]);

/** Invokes the reviewed provider-specific driver without involving an agent or shell arguments. */
export class TrackerOutgoingDriverAdapter {
	private readonly executable: string;

	constructor(private readonly config: TrackerOutgoingDriverAdapterConfig) {
		this.executable = controlledTrackerExecutable(config.executable);
	}

	matches(message: TrackerOutgoingMessage): boolean {
		return (
			message.channel === this.config.channel &&
			message.account === this.config.account &&
			message.to.length === 1 &&
			this.config.destinations.includes(message.to[0])
		);
	}

	async send(message: TrackerOutgoingMessage, attempt: string): Promise<TrackerOutgoingResult> {
		if (!this.matches(message) || !z.uuid().safeParse(attempt).success) return { kind: 'failed' };
		try {
			const result = await runTrackerHostCommand(this.executable, [], AbortSignal.timeout(11_000), {
				input: JSON.stringify({ attempt, message }),
				maxBuffer: 16 * 1024
			});
			if (result.code !== 0) return { kind: 'unconfirmed' };
			const decoded = outcome.parse(JSON.parse(result.stdout));
			if (decoded.kind !== 'sent') return decoded;
			const { reference, url } = decoded.receipt;
			return { kind: 'sent', receipt: { reference, ...(this.safe(url) && { url }) } };
		} catch {
			// A failure to read a receipt says nothing about whether a provider accepted the request.
			return { kind: 'unconfirmed' };
		}
	}

	private safe(link?: string) {
		if (!link) return false;
		const url = new URL(link);
		return !url.username && !url.password && this.config.receiptOrigins.includes(url.origin);
	}
}

export type { TrackerOutgoingDriverAdapterConfig } from './TrackerOutgoingDriverAdapter.types';
