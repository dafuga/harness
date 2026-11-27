// @harness-uid u_4usb4rrlje
import { z } from 'zod';
import { trackerItemError } from '../../../utils/projects-sessions/trackerItemError';
import type { TrackerOutgoingMessage } from '../../../repositories/projects-sessions/TrackerOutgoingDraftRepository.types';

const label = z
	.string()
	.trim()
	.min(1)
	.max(256)
	.regex(/^[^\p{Cc}]+$/u);
const address = label.pipe(z.string().max(254));
const safeLink = z
	.url({ protocol: /^https?$/ })
	.max(2048)
	.refine((value) => {
		const url = new URL(value);
		return !url.username && !url.password;
	});
const channel = z.enum(['gmail', 'slack', 'imessage', 'sms', 'telegram', 'github-comment', 'post']);
const addresses = z.array(address).max(30);
const draftFields = z.strictObject({
	to: addresses.min(1),
	cc: addresses,
	subject: label.optional(),
	body: z
		.string()
		.min(1)
		.max(16000)
		.regex(/\S/u)
		.refine((value) => !/\p{Cc}/u.test(value.replace(/[\t\n\r]/g, '')))
});
const draftMessage = draftFields.extend({
	channel,
	account: label,
	thread: z.strictObject({ id: label, label, url: safeLink.optional() }).optional()
});
const draftId = z.uuid();
const createDraft = z.strictObject({
	id: draftId,
	itemId: z.string().regex(/^[a-z0-9]{10}$/),
	message: draftMessage
});
const revision = z.strictObject({ id: draftId, revision: z.int().positive() });
export const outgoingReceipt = z.strictObject({ reference: label, url: safeLink.optional() });

export function parseOutgoingDraft(value: unknown) {
	const parsed = createDraft.safeParse(value);
	if (!parsed.success) throw trackerItemError('invalid draft');
	validateOutgoingMessage(parsed.data.message);
	return parsed.data;
}

export function parseOutgoingEditor(input: unknown, current: TrackerOutgoingMessage) {
	const parsed = draftFields.safeParse(input);
	if (!parsed.success) throw trackerItemError('invalid draft edit');
	const message = { ...current, subject: undefined, ...parsed.data };
	validateOutgoingMessage(message);
	return message;
}

export function parseOutgoingRevision(value: unknown) {
	const parsed = revision.safeParse(value);
	if (!parsed.success) throw trackerItemError('invalid draft revision');
	return parsed.data;
}

function validateOutgoingMessage(message: TrackerOutgoingMessage) {
	const { channel: kind, to, cc, subject } = message;
	if (kind === 'gmail') {
		if ([...to, ...cc].some((entry) => !z.email().safeParse(entry).success))
			throw trackerItemError('invalid email recipient');
		return;
	}
	if (cc.length || subject || to.length !== 1)
		throw trackerItemError('invalid channel destination');
	if (kind === 'sms' && !/^\+[1-9][0-9]{6,14}$/.test(to[0]))
		throw trackerItemError('invalid SMS recipient');
}
