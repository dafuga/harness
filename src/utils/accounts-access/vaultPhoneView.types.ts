// @harness-uid u_dqmcgtq5ga

export interface VaultPhoneViewInput {
	phase: 'pending' | 'approved' | 'operating' | 'ended';
	relay: 'up' | 'down';
	accessTunnel: 'up' | 'down' | 'unconfigured';
	now: number;
}

export type VaultPhoneViewPlan =
	| { transport: 'harness-relay'; expiresAt: number }
	| { transport: 'access-tunnel'; oneTimeToken: true; expiresAt: number }
	| { transport: 'none'; reason: string };
