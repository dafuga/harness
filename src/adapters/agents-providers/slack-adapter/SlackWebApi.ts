// @harness-uid u_gobadi5tr6
import { createHash } from 'node:crypto';
import type {
	PlatformFailureCode,
	PlatformIdentity,
	PlatformMessage,
	PlatformReceipt
} from '../../../core/agents-providers/platformAdapter.types';
import type { SlackAdapterConfig } from '../SlackAdapter.types';
import { SlackRequestError } from './SlackRequestError';
import { authReply, postReply, socketAddress } from './slackWire';

import type { SlackAssistantMethod } from './SlackWebApi.types';

const endpoint = 'https://slack.com/api/';
const defaultRetryMs = 1000;
const ambiguousErrors = new Set([
	'fatal_error',
	'internal_error',
	'request_timeout',
	'service_unavailable'
]);

/** Keeps Vault tokens and raw Slack responses inside the trusted transport. */
export class SlackWebApi {
	private verifiedToken?: string;

	constructor(private readonly config: SlackAdapterConfig) {}

	identity(): Promise<PlatformIdentity> {
		return this.use('bot', (token) => this.verify(token));
	}

	post(message: PlatformMessage): Promise<PlatformReceipt> {
		return this.use('bot', async (token) => {
			await this.verify(token);
			const raw = await this.request('chat.postMessage', token, {
				channel: message.channelId,
				text: message.text,
				thread_ts: message.threadId,
				blocks: message.blocks,
				unfurl_links: false,
				unfurl_media: false
			});
			const posted = postReply.safeParse(raw);
			if (!posted.success || posted.data.channel !== message.channelId)
				throw new SlackRequestError('delivery-unknown');
			return { channelId: posted.data.channel, messageId: posted.data.ts };
		});
	}

	assistantCommand(method: SlackAssistantMethod, body: object): Promise<unknown> {
		return this.use('bot', async (token) => {
			await this.verify(token);
			return this.request(method, token, body);
		});
	}

	openSocket(): Promise<URL> {
		return this.use('socket', async (token) => {
			const data = socketAddress.safeParse(await this.request('apps.connections.open', token));
			if (!data.success) throw new SlackRequestError('provider-refused');
			const target = URL.parse(data.data.url);
			if (!target || !isSlackSocket(target)) throw new SlackRequestError('provider-refused');
			return target;
		});
	}

	private async verify(token: string): Promise<PlatformIdentity> {
		const { workspaceId, botId, botUserId } = this.config.installation;
		const digest = createHash('sha256').update(token).digest('hex');
		if (this.verifiedToken !== digest) {
			const body = authReply.safeParse(await this.request('auth.test', token));
			if (
				!body.success ||
				body.data.team_id !== workspaceId ||
				body.data.bot_id !== botId ||
				body.data.user_id !== botUserId
			)
				throw new SlackRequestError('identity-mismatch');
			this.verifiedToken = digest;
		}
		return { workspaceId, botId, botUserId };
	}

	private async use<T>(purpose: 'bot' | 'socket', run: (token: string) => Promise<T>): Promise<T> {
		let used: Promise<T> | undefined;
		const scope = Object.freeze({ ...this.config.installation, purpose });
		try {
			await this.config.vault.withToken(
				scope,
				(token) => (used ??= useScopedToken(purpose, token, run))
			);
		} catch {
			// Preserve an already dispatched operation even if Vault cleanup reports a failure.
		}
		if (!used) throw new SlackRequestError('credential-unavailable');
		return used;
	}

	private async request(
		method: 'auth.test' | 'chat.postMessage' | 'apps.connections.open' | SlackAssistantMethod,
		token: string,
		body?: object
	): Promise<unknown> {
		const unavailable = method === 'chat.postMessage' ? 'delivery-unknown' : 'provider-unavailable';
		let response: Response;
		try {
			response = await fetch(endpoint + method, {
				method: 'POST',
				redirect: 'error',
				signal: AbortSignal.timeout(10_000),
				headers: {
					authorization: 'Bearer ' + token,
					'content-type': body ? 'application/json' : 'application/x-www-form-urlencoded'
				},
				body: body && JSON.stringify(body)
			});
		} catch {
			throw new SlackRequestError(unavailable);
		}
		if (response.status === 429)
			throw new SlackRequestError('rate-limited', retryAfter(response.headers, defaultRetryMs));
		if (response.status >= 500) throw new SlackRequestError(unavailable);
		if (!response.ok) throw new SlackRequestError('provider-refused');

		return readReply(response, unavailable);
	}
}

function isSlackSocket(url: URL): boolean {
	return (
		url.protocol === 'wss:' &&
		/^wss(?:-[a-z0-9]+)?\.slack\.com$/.test(url.hostname) &&
		!url.port &&
		!url.username &&
		!url.password &&
		!url.hash &&
		url.pathname === '/link/'
	);
}

function retryAfter(headers: Headers, fallback: number): number {
	const value = headers.get('retry-after');
	if (!value || !/^\d+$/.test(value)) return fallback;
	const milliseconds = Number(value) * 1000;
	return Math.min(Number.MAX_SAFE_INTEGER - Date.now(), Math.max(fallback, milliseconds));
}

async function useScopedToken<T>(
	purpose: 'bot' | 'socket',
	token: string,
	run: (token: string) => Promise<T>
): Promise<T> {
	const pattern = purpose === 'bot' ? /^xoxb-[a-zA-Z0-9-]+$/ : /^xapp-[a-zA-Z0-9-]+$/;
	if (!pattern.test(token)) throw new SlackRequestError('credential-unavailable');
	try {
		return await run(token);
	} catch (error) {
		if (error instanceof SlackRequestError) throw error;
		throw new SlackRequestError('provider-unavailable');
	}
}

async function readReply(response: Response, unavailable: PlatformFailureCode): Promise<unknown> {
	const decoded: unknown = await response.json().catch(() => null);
	if (decoded && typeof decoded === 'object' && 'ok' in decoded && decoded.ok === false) {
		if (
			'error' in decoded &&
			typeof decoded.error === 'string' &&
			ambiguousErrors.has(decoded.error)
		)
			throw new SlackRequestError(unavailable);
		throw new SlackRequestError('provider-refused');
	}
	return decoded;
}
