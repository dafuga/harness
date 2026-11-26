// @harness-uid u_hsyfpu5tqc
import type {
	HubMessageEvent,
	HubMessageTarget,
	HubThreadMessage,
	HubThreadNote
} from './hubSessionMessages.types';
export type * from './hubSessionMessages.types';

/** A message id names its thread item, so a reply needs nothing else: `<item id>-<8 hex>`. */
export const hubMessageIdPattern = /^([0-9a-z]{10})-([0-9a-f]{8})$/;
const id = '([0-9a-z]{10}-[0-9a-f]{8})';
const sent = new RegExp(`^Hub message ${id} to (Chief of Staff|run ([^\\s#]+)#(\\d+)): `);
const delivered = new RegExp(`^Hub message ${id} delivered to (\\S+)$`);
const refused = new RegExp(`^Hub message ${id} not delivered: `);
const reply = new RegExp(`^Reply to Hub message ${id}: `);
const unsafe = /[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]+/gu;

/** One line without control characters: the only text a pane is ever given. */
export function hubMessageLine(text: string): string {
	return text.replace(unsafe, ' ').replace(/ {2,}/g, ' ').trim();
}

export function hubMessageId(itemId: string, uuid: string): string | null {
	const tail = uuid.replace(/-/g, '').slice(0, 8).toLowerCase();
	const value = `${itemId}-${tail}`;
	return hubMessageIdPattern.test(value) ? value : null;
}

export function hubMessageItem(messageId: string): string | null {
	return hubMessageIdPattern.exec(messageId)?.[1] ?? null;
}

export function hubMessageTargetLabel(target: HubMessageTarget): string {
	return target.kind === 'cos' ? 'Chief of Staff' : `run ${target.node}#${target.runId}`;
}

export function formatHubMessageNote(messageId: string, target: HubMessageTarget, text: string) {
	return `Hub message ${messageId} to ${hubMessageTargetLabel(target)}: ${hubMessageLine(text)}`;
}

export function formatHubDeliveredNote(messageId: string, session: string) {
	return `Hub message ${messageId} delivered to ${session}`;
}

export function formatHubRefusedNote(messageId: string, reason: string) {
	return `Hub message ${messageId} not delivered: ${hubMessageLine(reason)}`;
}

export function formatHubReplyNote(messageId: string, text: string) {
	return `Reply to Hub message ${messageId}: ${hubMessageLine(text)}`;
}

/**
 * What the session sees typed into its prompt. It never starts with a slash or `!`, so it can
 * only be read as a message, and it says exactly how to answer.
 */
export function hubPaneMessage(messageId: string, text: string): string {
	return hubMessageLine(
		`Message from Daniel via Hub (${messageId}): ${text} -- Reply to Daniel in the Hub with: ` +
			`tracker reply ${messageId} "<your reply>"`
	);
}

/** Reads one Tracker note as a Hub message event, or null for any other note. */
export function parseHubMessageNote(text: string): HubMessageEvent | null {
	const message = sent.exec(text);
	if (message) {
		const [head, messageId, , node, run] = message;
		const target: HubMessageTarget = node
			? { kind: 'run', node, runId: Number(run) }
			: { kind: 'cos' };
		return { type: 'message', id: messageId, target, text: text.slice(head.length) };
	}
	const done = delivered.exec(text);
	if (done) return { type: 'delivered', id: done[1], session: done[2] };
	const refusal = refused.exec(text);
	if (refusal) return { type: 'refused', id: refusal[1], reason: text.slice(refusal[0].length) };
	const answer = reply.exec(text);
	if (answer) return { type: 'reply', id: answer[1], text: text.slice(answer[0].length) };
	return null;
}

/** Folds an item's notes, oldest first, into its Hub messages with their receipts and replies. */
export function hubSessionMessages(notes: readonly HubThreadNote[]): HubThreadMessage[] {
	const messages = new Map<string, HubThreadMessage>();
	for (const note of notes) {
		const event = parseHubMessageNote(note.text);
		if (!event) continue;
		if (event.type === 'message') {
			if (!messages.has(event.id))
				messages.set(event.id, {
					id: event.id,
					target: event.target,
					text: event.text,
					at: note.at,
					status: 'stored',
					replies: []
				});
			continue;
		}
		const message = messages.get(event.id);
		if (message) applyEvent(message, event, note.at);
	}
	return [...messages.values()];
}

function applyEvent(message: HubThreadMessage, event: HubMessageEvent, at: string) {
	if (event.type === 'delivered' && message.status === 'stored') {
		message.status = 'delivered';
		message.session = event.session;
		message.deliveredAt = at;
	} else if (event.type === 'refused' && message.status === 'stored') {
		message.status = 'refused';
		message.reason = event.reason;
	} else if (event.type === 'reply') {
		message.replies.push({ text: event.text, at });
		if (message.status !== 'refused') message.status = 'acknowledged';
	}
}
