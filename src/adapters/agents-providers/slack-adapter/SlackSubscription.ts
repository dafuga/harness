// @harness-uid u_naf56tgnv7
import { setTimeout as pause } from 'node:timers/promises';
import type {
	PlatformAuditDetail,
	PlatformEvent,
	PlatformEventHandler
} from '../../../core/agents-providers/platformAdapter.types';
import type { SlackAdapterConfig } from '../SlackAdapter.types';
import { SlackRequestError } from './SlackRequestError';
import type { SlackWebApi } from './SlackWebApi';
import { openSlackSocket } from './openSlackSocket';
import { callback, envelope } from './slackWire';

const maxAcceptedEvents = 10_000;
const maxBackoffMs = 30_000;

export class SlackSubscription {
	private listening = false;
	private backoff = 1000;
	private readonly accepted = new Map<string, boolean>();

	constructor(
		private readonly api: SlackWebApi,
		private readonly config: SlackAdapterConfig,
		private readonly channels: ReadonlySet<string>,
		private readonly audit: (detail: PlatformAuditDetail) => Promise<void>
	) {}

	async run(handler: PlatformEventHandler, signal: AbortSignal): Promise<void> {
		if (signal.aborted) return;
		if (this.listening) throw new SlackRequestError('busy');
		this.listening = true;
		this.backoff = 1000;
		try {
			await this.api.identity();
			await this.listen(handler, signal);
		} finally {
			this.listening = false;
		}
	}

	private async listen(handler: PlatformEventHandler, signal: AbortSignal): Promise<void> {
		while (!signal.aborted) {
			let reason: 'disconnect' | 'connection-failed' = 'disconnect';
			let delay = this.backoff;
			try {
				await this.read(handler, signal);
				delay = this.backoff;
			} catch (error) {
				if (signal.aborted) return;
				if (isTerminal(error)) throw error;
				reason = 'connection-failed';
				delay = Math.max(
					this.backoff,
					error instanceof SlackRequestError ? (error.retryAfterMs ?? 0) : 0
				);
			}
			if (signal.aborted) return;
			await this.audit({ kind: 'receive-reconnect', reason });
			await waitForReconnect(delay, signal);
			this.backoff = Math.min(maxBackoffMs, this.backoff * 2);
		}
	}

	private async read(handler: PlatformEventHandler, signal: AbortSignal): Promise<void> {
		const url = await this.api.openSocket();
		if (signal.aborted) return;
		const connection = openSlackSocket(url, signal);
		try {
			for await (const frame of connection.frames) {
				if (signal.aborted) return;
				const packet = parseEnvelope(frame);
				if (!packet) continue;
				if (packet.type === 'disconnect') return;
				if (!packet.envelope_id) continue;
				const event =
					packet.type === 'events_api'
						? slackEvent(packet.payload, this.config, this.channels)
						: undefined;
				if (event) await this.accept(event, handler, signal);
				if (!signal.aborted) await connection.ack(packet.envelope_id);
				this.backoff = 1000;
			}
		} finally {
			connection.close();
		}
	}

	private async accept(
		event: PlatformEvent,
		handler: PlatformEventHandler,
		signal: AbortSignal
	): Promise<void> {
		const metadata = { eventId: event.id, channelId: event.channelId };
		if (!this.accepted.has(event.id)) {
			await this.audit({ kind: 'receive-attempt', ...metadata });
			if (signal.aborted) return;
			try {
				await handler(event, signal);
			} catch {
				throw new SlackRequestError('provider-refused');
			}
			if (this.accepted.size >= maxAcceptedEvents) {
				const oldest = this.accepted.keys().next().value;
				if (oldest !== undefined) this.accepted.delete(oldest);
			}
			this.accepted.set(event.id, false);
		}
		if (!this.accepted.get(event.id)) {
			await this.audit({ kind: 'receive-accepted', ...metadata });
			this.accepted.set(event.id, true);
		}
	}
}

function parseEnvelope(frame: unknown) {
	if (!Buffer.isBuffer(frame) && typeof frame !== 'string') return undefined;
	try {
		const parsed = envelope.safeParse(JSON.parse(frame.toString()));
		return parsed.success ? parsed.data : undefined;
	} catch {
		return undefined;
	}
}

function isTerminal(error: unknown): error is SlackRequestError {
	return (
		error instanceof SlackRequestError &&
		(error.code === 'credential-unavailable' ||
			error.code === 'identity-mismatch' ||
			error.code === 'audit-unavailable')
	);
}

async function waitForReconnect(delay: number, signal: AbortSignal): Promise<void> {
	const readyAt = Date.now() + delay;
	while (!signal.aborted && Date.now() < readyAt) {
		await pause(Math.min(readyAt - Date.now(), maxBackoffMs), undefined, { signal }).catch(
			() => undefined
		);
	}
}

function slackEvent(
	payload: unknown,
	config: SlackAdapterConfig,
	channels: ReadonlySet<string>
): PlatformEvent | undefined {
	const parsed = callback.safeParse(payload);
	if (!parsed.success) return undefined;
	const data = parsed.data;
	const { event } = data;
	const { appId, workspaceId, botUserId } = config.installation;
	if (data.team_id !== workspaceId || data.api_app_id !== appId) return undefined;
	if (event.type !== (config.receive === 'mentions' ? 'app_mention' : 'message')) return undefined;
	if (event.user === botUserId || !channels.has(event.channel)) return undefined;
	if ([event.team, event.user_team, event.source_team].some((team) => team && team !== workspaceId))
		return undefined;
	return {
		id: data.event_id,
		channelId: event.channel,
		senderId: event.user,
		text: event.text,
		messageId: event.ts,
		...(event.thread_ts ? { threadId: event.thread_ts } : {})
	};
}
