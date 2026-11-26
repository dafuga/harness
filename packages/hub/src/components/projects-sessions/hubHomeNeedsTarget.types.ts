// @harness-uid u_qqw5gi3hpk
export type NeedsTarget =
	| { kind: 'wait' }
	| { kind: 'ask'; agentId: string }
	| { kind: 'list' }
	| { kind: 'none' };
