// @harness-uid u_apuvwehhpw
import { z } from 'zod';
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

export const homeOutgoingPath = '/api/outgoing-drafts';

const draft = z.object({
	id: z.string().min(1),
	revision: z.int().positive(),
	status: z.enum(['draft', 'sent', 'discarded']),
	delivery: z.enum(['idle', 'sending', 'failed', 'unconfirmed']),
	canSend: z.boolean().optional(),
	message: z.object({
		channel: z.enum(['gmail', 'slack', 'imessage', 'sms', 'telegram', 'github-comment', 'post']),
		account: z.string(),
		to: z.array(z.string()),
		cc: z.array(z.string()),
		subject: z.string().optional(),
		body: z.string(),
		thread: z.object({ label: z.string(), url: z.string().optional() }).optional()
	}),
	receipt: z.object({ url: z.string().optional() }).nullish(),
	reason: z.string().optional()
});

export function readOutgoingDraft(value: unknown): HomeOutgoingDraft {
	return draft.parse(value);
}

export function readOutgoingQueue(value: unknown): HomeOutgoingDraft[] {
	return z.array(draft).parse(value);
}
