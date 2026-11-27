// @harness-uid u_bizwcg2fkv
import type { HomeChatItemContext } from './hubHomeChatContext.types';
import type {
	HomeAgent,
	HomeChatInput,
	HomeChatReceipt,
	HomeRun
} from '$reports/lib/projects-sessions/hub-home/hubHome.types';

/**
 * Chief of Staff and a session with a live run get a message typed into their prompt; anything
 * else can only take a Tracker note on its current item.
 */
export function composedMessage(agent: HomeAgent, text: string): HomeChatInput | null {
	const id = crypto.randomUUID();
	if (agent.id === 'cos')
		return { id, agentId: 'cos', itemId: 'cos', kind: 'message', question: null, text };
	if (!agent.itemId) return null;
	const base = { id, agentId: agent.id, itemId: agent.itemId, question: null, text };
	return agent.runId ? { ...base, kind: 'message', runId: agent.runId } : { ...base, kind: 'note' };
}

export function composerFeedback(
	message: HomeChatInput,
	receipt: HomeChatReceipt,
	name: string
): string {
	if (receipt.status === 'queued') return 'Queued for Tracker';
	if (receipt.status !== 'sent') return 'Tracker did not accept the message.';
	if (message.kind !== 'message') return 'Sent to Tracker';
	return message.agentId === 'cos'
		? `Stored in Tracker; it goes to ${name} through its Tracker channel.`
		: `Stored in Tracker; it goes to ${name} at its next empty prompt.`;
}

/** A send of this chat that the Tracker's thread does not show yet. */
export function isPending(
	entry: { message: HomeChatInput; receipt: HomeChatReceipt },
	agent: HomeAgent
): boolean {
	const { message, receipt } = entry;
	if (message.agentId !== agent.id) return false;
	if (message.kind !== 'message' && message.itemId !== agent.itemId) return false;
	return !agent.messages.some((known) =>
		receipt.messageId
			? known.messageId === receipt.messageId
			: known.from === 'you' && known.text === message.text
	);
}

export function receiptText(receipt: HomeChatReceipt): string {
	if (receipt.status === 'sent') return receipt.messageId ? 'Stored in Tracker' : 'Sent to Tracker';
	if (receipt.status === 'queued') return 'Queued for Tracker';
	return receipt.status === 'refused' ? 'Not accepted' : 'Not confirmed';
}

/** @pure Reserves space in the existing Tracker message for the item attached from Home. */
export function homeChatItemSuffix(item?: HomeChatItemContext): string {
	if (!item) return '';
	const title = item.title.trim().slice(0, 300);
	const id = item.id.trim().slice(0, 200);
	const details = item.details?.trim().slice(0, 300);
	return `\n\nAttached Hub item: ${title} (${id})${details ? `\n${details}` : ''}`;
}

export function scheduledChatItem(run: HomeRun): HomeChatItemContext {
	return {
		id: run.id,
		title: run.title,
		details: [
			run.source === 'claude' ? 'Claude routine' : 'Tracker',
			run.at,
			run.agent,
			run.machine
		]
			.filter(Boolean)
			.join(' · ')
	};
}
