// @harness-uid u_wv57i4bcri

export type VaultTeardownStep =
	| { step: 'close-gateway'; by: number }
	| { step: 'provider-logout'; path: string; by: number }
	| { step: 'revoke-sessions'; via: string; by: number }
	| { step: 'remove-container'; by: number }
	| { step: 'verify-removal'; by: number }
	| { step: 'security-log'; source: string; at: number; from: number }
	| { step: 'flag-unverifiable'; reason: string; at: number };

export interface VaultTeardownInput {
	teardown: { logout: string | null; revoke: string | null; securityLog: string | null };
	browser: boolean;
	leaseStartedAt: number;
	endedAt: number;
}
