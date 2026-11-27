// @harness-uid u_dbz3ravmb5

/** One enrolled phone; recovery devices may only read backups and never approve. */
export interface VaultDevice {
	id: string;
	role: 'approver' | 'recovery';
	/** Uncompressed P-256 public key, base64url. */
	signingKey: string;
}

export interface VaultChallenge {
	nonce: string;
	expiresAt: number;
}

/** Validated intent for an enrolled device to acquire a route-scoped challenge. */
export interface VaultSignedChallengeScope {
	requestPath: string;
	responsePath: string;
	expiresAt: number;
}
