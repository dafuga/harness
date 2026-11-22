// @harness-uid u_gs3dblm5pw

export type VaultLeasePhase = 'issued' | 'active' | 'disconnected' | 'ended';

export type VaultLeaseEnd =
	| 'finished'
	| 'expired'
	| 'idle'
	| 'unclaimed'
	| 'reconnect-window'
	| 'revoked'
	| 'shutdown';

export interface VaultLeaseState {
	id: string;
	session: string;
	phase: VaultLeasePhase;
	issuedAt: number;
	claimBy: number;
	expiresAt: number;
	lastActivity: number;
	disconnectedAt: number | null;
	reconnects: number;
	ended: VaultLeaseEnd | null;
}

export type VaultLeaseEvent =
	| { type: 'claim' | 'reconnect'; session: string; at: number }
	| { type: 'activity' | 'disconnect' | 'tick'; at: number }
	| { type: 'finish' | 'revoke' | 'shutdown'; at: number };

export interface VaultLeaseResult {
	state: VaultLeaseState;
	accepted: boolean;
	reason?: string;
}
