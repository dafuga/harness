import type {
	HomeChatInput,
	HomeChatReceipt,
	OwnerHomeSnapshot
} from '$reports/lib/projects-sessions/hub-home/hubHome.types';

/** Whether this computer reported the open ask being answered, or the agent's item being noted. */
export function showsHomeChatTarget(snapshot: OwnerHomeSnapshot, message: HomeChatInput) {
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
export function homeChatReceipt(id: string, reply: unknown): HomeChatReceipt {
	const status = (reply as Partial<HomeChatReceipt> | null)?.status;
	return { id, status: status === 'sent' || status === 'refused' ? status : 'unconfirmed' };
}
