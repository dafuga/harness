// @harness-uid u_xzwv5okyoc
export interface SubscriptionLimit {
	id: string;
	label: string;
	left: number;
	resetsAt: string | null;
}

export interface SubscriptionReading {
	id: string;
	provider: 'claude' | 'codex';
	plan: string | null;
	account: null;
	readAt: string;
	limits: SubscriptionLimit[];
	credits: string | null;
	history: [];
	agents: [];
}

export type SubscriptionReader = (now: number) => Promise<SubscriptionReading | null>;
