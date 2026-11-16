// @harness-uid u_5gsnsmohic
export interface AgentCall {
	method: string;
	input: unknown;
	requestId?: string;
	revision?: { branch: string; commit: string };
}

export class AgentBranchTipViewRequiredError extends Error {
	override name = 'AgentBranchTipViewRequiredError';
}

export class UnacknowledgedAgentRequestError extends Error {
	override name = 'UnacknowledgedAgentRequestError';
}
