// @harness-uid u_vnrjbevch3
import { SlackAdapter } from '../../../adapters/agents-providers/SlackAdapter';
import type { PlatformSendResult } from '../../../core/agents-providers/platformAdapter.types';
import type { XDigestSenderConfig } from '../../../core/agents-providers/xDigestSend.types';
import { PlatformAuditLogRepository } from '../../../repositories/agents-providers/PlatformAuditLogRepository';

/** Sends through the Slack platform adapter, bound to the one direct message in the config. */
export function xDigestSlack(
	config: XDigestSenderConfig['slack'],
	auditPath: string,
	token: () => Promise<string>
): (text: string) => Promise<PlatformSendResult> {
	const audit = new PlatformAuditLogRepository(auditPath);
	const adapter = new SlackAdapter({
		installation: config.installation,
		channels: [config.channel],
		receive: 'none',
		vault: { withToken: async (_scope, use) => use(await token()) },
		audit: (event) => audit.append(event)
	});
	return (text) => adapter.send({ channelId: config.channel, text });
}
