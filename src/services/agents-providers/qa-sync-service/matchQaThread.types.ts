// @harness-uid u_4zg3zprxrv
export type QaThreadMatch =
	| { kind: 'qa'; issue: number }
	| { kind: 'ambiguous'; issue: number; linked: number[] }
	| { kind: 'other' };
