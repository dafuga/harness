// @harness-uid u_iv68zgm4h4
import type {
	AgentThread,
	AgentThreadEntry,
	AgentThreadEntryKind,
	AgentThreadMessage,
	AgentThreadRefusal,
	AgentThreadResult,
	AgentThreadScope
} from './agentThread.types';

const labels: Record<AgentThreadEntryKind, string> = {
	'tracker-note': 'Posted Tracker note',
	delivered: 'Delivered to agent',
	'agent-reply': 'Agent reply'
};

/** Fixed, sanitized wording for a thread entry. Never shows the scope identifiers. */
export function entryLabel(kind: AgentThreadEntryKind): string {
	return labels[kind];
}

export function openThread(scope: AgentThreadScope): AgentThread {
	return { scope, entries: [] };
}

/** Every field must match the live run. The first mismatch names the refusal. */
export function scopeRefusal(
	expected: AgentThreadScope,
	live: AgentThreadScope
): AgentThreadRefusal | null {
	if (live.accountId !== expected.accountId) return 'other-account';
	if (live.projectId !== expected.projectId) return 'other-project';
	if (live.sessionId !== expected.sessionId) return 'other-session';
	if (live.runId !== expected.runId) return 'replaced-run';
	return null;
}

/** A posted Tracker note is recorded for the thread. It is not a delivery to the agent. */
export function recordTrackerNote(
	thread: AgentThread,
	message: AgentThreadMessage
): AgentThreadResult {
	return append(thread, { ...message, kind: 'tracker-note', scope: thread.scope, refId: null });
}

/** Refused unless the live run is the one this thread is bound to. */
export function deliverToAgent(
	thread: AgentThread,
	live: AgentThreadScope,
	message: AgentThreadMessage
): AgentThreadResult {
	const refusal = scopeRefusal(thread.scope, live);
	if (refusal) return { ok: false, reason: refusal };
	return append(thread, { ...message, kind: 'delivered', scope: thread.scope, refId: null });
}

/** A reply counts only from the bound run and only for a message delivered in this thread. */
export function recordAgentReply(
	thread: AgentThread,
	live: AgentThreadScope,
	reply: AgentThreadMessage & { refId: string }
): AgentThreadResult {
	const refusal = scopeRefusal(thread.scope, live);
	if (refusal) return { ok: false, reason: refusal };
	const answers = thread.entries.some(
		(entry) => entry.kind === 'delivered' && entry.id === reply.refId
	);
	if (!answers) return { ok: false, reason: 'unknown-delivery' };
	return append(thread, { ...reply, kind: 'agent-reply', scope: thread.scope });
}

function append(thread: AgentThread, entry: AgentThreadEntry): AgentThreadResult {
	if (thread.entries.some((existing) => existing.id === entry.id))
		return { ok: false, reason: 'duplicate-id' };
	return { ok: true, thread: { ...thread, entries: [...thread.entries, entry] } };
}
