// @harness-uid u_gobadi5tr6
import { createHash } from 'node:crypto';
import type {
	PlatformIdentity,
	PlatformMessage,
	PlatformReceipt
} from '../../../core/agents-providers/platformAdapter.types';
import type { SlackAdapterConfig } from '../SlackAdapter.types';
import { SlackRequestError } from './SlackRequestError';
import { authReply, socketAddress } from './slackWire';
import { slackRequest } from './slackRequest';
import { postSlackMessage } from './postSlackMessage';

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
			return postSlackMessage(fetch, token, message);
		});
	}

	openSocket(): Promise<URL> {
		return this.use('socket', async (token) => {
			const data = socketAddress.safeParse(
				await slackRequest(fetch, 'apps.connections.open', token)
			);
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
			const body = authReply.safeParse(await slackRequest(fetch, 'auth.test', token));
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
