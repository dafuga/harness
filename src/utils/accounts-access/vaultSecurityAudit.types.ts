// @harness-uid u_eaaw6eeoc4

export type VaultSecurityEventKind =
	| 'token-created'
	| 'oauth-grant'
	| 'recovery-changed'
	| 'mfa-changed'
	| 'password-changed'
	| 'session-created'
	| 'login'
	| 'other';

/** One provider security log entry, reduced to metadata by the recipe's log reader. */
export interface VaultSecurityEvent {
	kind: VaultSecurityEventKind;
	at: number;
	session?: string;
}

export interface VaultSecurityWindow {
	from: number;
	to: number;
	/** Provider session IDs that the lease's own scripted login created. */
	leaseSessions: string[];
}

export type VaultSecurityVerdict =
	| { verdict: 'clean'; checked: number }
	| { verdict: 'alert'; findings: VaultSecurityEvent[] }
	| { verdict: 'unverifiable'; reason: string };
