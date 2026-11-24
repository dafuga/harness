// @harness-uid u_uav5h9rqhl

/**
 * The three things a Chief of Staff or managed-agent conversation can contain, kept distinct:
 * - tracker-note: a note posted to the Tracker item. It says nothing about the agent reading it.
 * - delivered: a message accepted into the live managed run it was addressed to.
 * - agent-reply: a reply the run produced for one delivered message.
 */
export type AgentThreadEntryKind = 'tracker-note' | 'delivered' | 'agent-reply';

/** The identity a message is bound to. Every field must match the live run for delivery. */
export interface AgentThreadScope {
	accountId: string;
	projectId: string;
	sessionId: string;
	runId: string;
}

export interface AgentThreadEntry {
	id: string;
	kind: AgentThreadEntryKind;
	scope: AgentThreadScope;
	/** For agent-reply: the id of the delivered entry it answers. Null otherwise. */
	refId: string | null;
	text: string;
	at: string;
}

export interface AgentThread {
	scope: AgentThreadScope;
	entries: AgentThreadEntry[];
}

export type AgentThreadRefusal =
	| 'other-account'
	| 'other-project'
	| 'other-session'
	| 'replaced-run'
	| 'duplicate-id'
	| 'unknown-delivery';

export type AgentThreadResult =
	| { ok: true; thread: AgentThread }
	| { ok: false; reason: AgentThreadRefusal };

export interface AgentThreadMessage {
	id: string;
	text: string;
	at: string;
}
