// @harness-uid u_5gsnsmohic
export interface AgentCall {
	method: string;
	input: unknown;
	requestId?: string;
	revision?: { branch: string; commit: string };
}
