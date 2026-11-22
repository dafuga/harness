// @harness-uid u_g7t5qkhn5t
import type { VaultLeaseState } from './vaultLease.types';

/** What the host relay knows about one issued CDP handoff. */
export interface VaultCdpLease {
	lease: VaultLeaseState;
	/** OS user ID of the requesting session; the only peer allowed on the socket. */
	sessionUid: number;
	/** Lowercase hex SHA-256 of the one-time handoff token given to the session. */
	tokenDigest: string;
	/** Absolute path of the lease's Unix socket. */
	socketPath: string;
}

/** One incoming connection on the CDP Unix socket, with kernel-verified peer credentials. */
export interface VaultCdpConnection {
	peerUid: number | null;
	token: string;
	at: number;
}

export type VaultCdpDecision = { allowed: true } | { allowed: false; reason: string };
