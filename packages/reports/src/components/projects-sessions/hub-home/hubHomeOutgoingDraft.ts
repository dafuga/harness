// @harness-uid u_apuvwehhpw
import type { HarnessIconName } from '../../../utils/explorer-ui/harnessIcons.types';
import type { HomeOutgoingDraft } from './hubHomeOutgoingDraft.types';

export const outgoingChannels = {
	gmail: { label: 'Gmail', icon: 'mail' },
	slack: { label: 'Slack', icon: 'message' },
	imessage: { label: 'iMessage', icon: 'message' },
	sms: { label: 'SMS', icon: 'phone' },
	telegram: { label: 'Telegram', icon: 'message' },
	'github-comment': { label: 'GitHub comment', icon: 'branch' },
	post: { label: 'Post', icon: 'web' }
} satisfies Record<
	HomeOutgoingDraft['message']['channel'],
	{ label: string; icon: HarnessIconName }
>;

export function outgoingHref(value?: string) {
	if (!value) return;
	try {
		const url = new URL(value);
		if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
	} catch {
		return;
	}
}
