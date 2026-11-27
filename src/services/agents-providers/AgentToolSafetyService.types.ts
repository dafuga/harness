// @harness-uid u_3n5vo4mix3
export type AgentToolAction =
	| 'file-read'
	| 'network-read'
	| 'payment'
	| 'chain-write'
	| 'message'
	| 'delete'
	| 'publish'
	| 'deploy'
	| 'shell'
	| 'credential-use'
	| 'external-output';

export interface AgentToolScope {
	tool: string;
	resource: string;
}

export interface AgentToolPolicy {
	revision: string;
	specialty: string;
	declaredTools: readonly string[];
	grants: readonly AgentToolScope[];
	maxCallsPerMinute: number;
	budgets?: Readonly<Record<string, { perAction: number; lifetime: number }>>;
}

export interface AgentToolCharge {
	currency: string;
	maximum: number;
}

export interface PreparedAgentTool {
	resource: string;
	/** Safe, host-authored review text identifying the exact effect. */
	summary: string;
	/** Exact outgoing content, screened at admission and bound to owner approval. */
	content?: string;
	charge?: AgentToolCharge;
	/** Recheck the current grant at the effect boundary after any preparatory I/O. */
	execute: (assertCurrent: () => void) => unknown;
}

export interface AgentToolDefinition {
	action: AgentToolAction;
	prepare: (input: unknown) => PreparedAgentTool | undefined;
}

export type AgentToolDenial =
	| 'invalid-proposal'
	| 'unknown-tool'
	| 'not-authorized'
	| 'content-rejected'
	| 'content-unavailable'
	| 'approval-invalid'
	| 'rate-limit'
	| 'spend-limit'
	| 'journal-unavailable';

export type AgentToolEvent = {
	at: number;
	agentId: string;
	attemptId: string;
	tool?: string;
} & (
	| { state: 'requested' | 'completed' | 'failed' }
	| { state: 'denied'; reason: AgentToolDenial }
	| { state: 'held'; approval: AgentToolApproval }
	| { state: 'reserved'; approvalId?: string; charge?: AgentToolCharge }
);

export interface AgentToolApproval {
	id: string;
	agentId: string;
	expiresAt: number;
	fingerprint: string;
}

export interface AgentToolReview {
	id: string;
	expiresAt: number;
	action: AgentToolAction;
	summary: string;
	charge?: AgentToolCharge;
}

export interface AgentToolJournalTransaction {
	append(event: AgentToolEvent): void;
	/** Returns a held challenge only while it has no matching reservation. */
	pending(id: string): AgentToolApproval | undefined;
	usage(agentId: string, since: number, currency?: string): { count: number; spend: number };
}

export interface AgentToolJournal {
	/** Serialize, commit durably before returning, and roll back on throw. */
	transaction<T>(write: (journal: AgentToolJournalTransaction) => T): T;
}

export interface AgentToolSafetyOptions {
	tools: Readonly<Record<string, AgentToolDefinition>>;
	policy: (agentId: string) => AgentToolPolicy | undefined;
	journal: AgentToolJournal;
	checkContent?: (
		content: string,
		context: { specialty: string; action: AgentToolAction }
	) => boolean | Promise<boolean>;
	now?: () => number;
}

export type AgentToolDecision =
	| { status: 'denied'; reason: AgentToolDenial }
	| { status: 'held'; review: AgentToolReview }
	| { status: 'executed'; output: unknown }
	| { status: 'failed' };
