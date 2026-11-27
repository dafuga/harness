// @harness-uid u_3raczg2p4i
import { randomUUID } from 'node:crypto';
import type {
	PlatformAdapter,
	PlatformAuditDetail,
	PlatformEventHandler,
	PlatformIdentity,
	PlatformMessage,
	PlatformSendResult
} from '../../core/agents-providers/platformAdapter.types';
import type { SlackAdapterConfig } from './SlackAdapter.types';
import { refusedSend, SlackPostQueue } from './slack-adapter/SlackPostQueue';
import { SlackRequestError } from './slack-adapter/SlackRequestError';
import { SlackSubscription } from './slack-adapter/SlackSubscription';
import { SlackWebApi } from './slack-adapter/SlackWebApi';
import {
	appId,
	botId,
	channelId,
	parseSlackMessage,
	teamId,
	userId
} from './slack-adapter/slackWire';

const bindingName = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/;

/** Slack chat and Socket Mode for an explicitly authorized workspace installation. */
export class SlackAdapter implements PlatformAdapter {
	private readonly config: SlackAdapterConfig;
	private readonly channels: ReadonlySet<string>;
	private readonly api: SlackWebApi;
	private readonly posts: SlackPostQueue;
	private readonly subscription: SlackSubscription;

	constructor(config: SlackAdapterConfig) {
		validateBinding(config);
		this.config = { ...config, installation: Object.freeze({ ...config.installation }) };
		this.channels = new Set(config.channels);
		this.api = new SlackWebApi(this.config);
		const audit = (detail: PlatformAuditDetail) => this.audit(detail);
		this.posts = new SlackPostQueue((message) => this.api.post(message), audit);
		this.subscription = new SlackSubscription(this.api, this.config, this.channels, audit);
	}

	identity(): Promise<PlatformIdentity> {
		return this.api.identity();
	}

	async send(message: PlatformMessage): Promise<PlatformSendResult> {
		const requestId = randomUUID();
		const parsed = parseSlackMessage(message);
		const channelId = parsed?.channelId;
		try {
			await this.audit({ kind: 'send-attempt', requestId, channelId });
		} catch {
			return { status: 'refused', code: 'audit-unavailable', requestId, auditRecorded: false };
		}

		let result: PlatformSendResult;
		if (!parsed) result = refusedSend(requestId, new SlackRequestError('invalid-message'));
		else if (!this.channels.has(parsed.channelId) && !this.subscription.allowsDirectReply(parsed))
			result = refusedSend(requestId, new SlackRequestError('denied'));
		else result = await this.posts.send(parsed, requestId);

		try {
			const snapshot =
				result.status === 'sent' ? { ...result, receipt: { ...result.receipt } } : { ...result };
			await this.audit({ kind: 'send-result', result: snapshot });
		} catch {
			return { ...result, auditRecorded: false };
		}
		return result;
	}

	subscribe(handler: PlatformEventHandler, signal: AbortSignal): Promise<void> {
		if (this.config.receive === 'none') return Promise.reject(new SlackRequestError('denied'));
		return this.subscription.run(handler, signal);
	}

	private async audit(detail: PlatformAuditDetail): Promise<void> {
		const { installationId, workspaceId, botId } = this.config.installation;
		try {
			await this.config.audit({
				...detail,
				platform: 'slack',
				installationId,
				workspaceId,
				botId,
				timestampMs: Date.now()
			});
		} catch {
			throw new SlackRequestError('audit-unavailable');
		}
	}
}

function validateBinding({ installation, channels, receive }: SlackAdapterConfig): void {
	if (
		![installation.installationId, installation.project, installation.environment].every((value) =>
			bindingName.test(value)
		) ||
		!teamId.safeParse(installation.workspaceId).success ||
		!botId.safeParse(installation.botId).success ||
		!userId.safeParse(installation.botUserId).success ||
		!validAppId(installation.appId, receive) ||
		!['mentions', 'messages', 'none'].includes(receive) ||
		channels.length === 0 ||
		channels.some((id) => !channelId.safeParse(id).success)
	)
		throw new SlackRequestError('denied');
}

function validAppId(value: string | undefined, receive: SlackAdapterConfig['receive']): boolean {
	if (value === undefined) return receive === 'none';
	return appId.safeParse(value).success;
}

export type {
	SlackAdapterConfig,
	SlackCredentialScope,
	SlackInstallation,
	SlackVaultAccess
} from './SlackAdapter.types';
