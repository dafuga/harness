import { vi } from 'vitest';
import type {
	SlackAdapterConfig,
	SlackCredentialScope
} from '../../../../src/adapters/agents-providers/SlackAdapter';
import type { PlatformAuditEvent } from '../../../../src/core/agents-providers/platformAdapter.types';

export const botToken = 'xoxb-synthetic-fixture';
export const appToken = 'xapp-synthetic-fixture';
export const channel = 'CPUBLIC';
export const privateChannel = 'GPRIVATE';
export const thread = '1700000000.000005';
export const postedAt = '1700000000.000010';
export const installation = {
	installationId: 'fixture',
	project: 'harness',
	environment: 'test',
	appId: 'AFIXTURE',
	workspaceId: 'TWORKSPACE',
	botId: 'BFIXTURE',
	botUserId: 'UBOT'
};

export function slackFixture() {
	const audit: PlatformAuditEvent[] = [];
	const scopes: SlackCredentialScope[] = [];
	const config: SlackAdapterConfig = {
		installation,
		channels: [channel, privateChannel],
		receive: 'messages',
		vault: {
			async withToken(scope, use) {
				scopes.push(scope);
				return use(scope.purpose === 'bot' ? botToken : appToken);
			}
		},
		async audit(entry) {
			audit.push(entry);
		}
	};
	return { config, audit, scopes };
}

export function mockSlack(...replies: Response[]) {
	const run = vi.fn<typeof fetch>().mockImplementation(async () => {
		const next = replies.shift();
		if (!next) throw new Error('Unexpected mocked request.');
		return next;
	});
	vi.stubGlobal('fetch', run);
	return run;
}

export const auth = (overrides = {}) =>
	Response.json({
		ok: true,
		team_id: installation.workspaceId,
		bot_id: installation.botId,
		user_id: installation.botUserId,
		...overrides
	});
export const post = (target = channel) =>
	Response.json({ ok: true, channel: target, ts: postedAt });
export const socket = () =>
	Response.json({ ok: true, url: 'wss://wss.slack.com/link/?ticket=synthetic-fixture' });
