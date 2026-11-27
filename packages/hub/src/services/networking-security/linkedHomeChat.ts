// @harness-uid u_sl4rsq3jhi
import type {
	HomeChatInput,
	HomeChatReceipt,
	OwnerHomeSnapshot
} from '$reports/lib/projects-sessions/hub-home/hubHome.types';

/** Whether this computer reported what the write targets: an ask, an item, a run or a reminder. */
export function showsHomeChatTarget(snapshot: OwnerHomeSnapshot, message: HomeChatInput) {
	if (message.armed)
		return Boolean(
			snapshot.reminders?.some(
				(entry) => entry.itemId === message.itemId && entry.at === message.armed
			)
		);
	// Any computer's Tracker can take a Chief of Staff message; sync carries it to that pane.
	if (message.kind === 'message')
		return (
			message.agentId === 'cos' ||
			snapshot.agents.some(
				(agent) =>
					agent.id === message.agentId &&
					agent.itemId === message.itemId &&
					agent.runId === message.runId
			)
		);
	if (message.kind === 'note')
		return snapshot.agents.some(
			(agent) => agent.id === message.agentId && agent.itemId === message.itemId
		);
	return Boolean(
		snapshot.openAsks?.some(
			(ask) => ask.itemId === message.itemId && ask.question === message.question
		)
	);
}

/** A computer's reply, read as untrusted: anything but a plain outcome is unconfirmed. */
export function homeChatReceipt(
	id: string,
	reply: Partial<HomeChatReceipt> | null
): HomeChatReceipt {
	const { status, messageId } = reply ?? {};
	if (status !== 'sent' && status !== 'refused') return { id, status: 'unconfirmed' };
	return typeof messageId === 'string' && /^[0-9a-z]{10}-[0-9a-f]{8}$/.test(messageId)
		? { id, status, messageId }
		: { id, status };
}
