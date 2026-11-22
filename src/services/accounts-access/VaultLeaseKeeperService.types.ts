// @harness-uid u_crruvpexlz
import type { VaultLeaseState } from '../../utils/accounts-access/vaultLease.types';
import type { VaultTeardownStep } from '../../utils/accounts-access/vaultTeardown.types';
import type { VaultRequestEntry } from './VaultBrokerService.types';

export interface VaultTeardownPaths {
	logout: string | null;
	revoke: string | null;
	securityLog: string | null;
}

/** A lease the keeper holds; the handoff token exists only as its SHA-256 digest. */
export interface VaultHeldLease {
	state: VaultLeaseState;
	request: VaultRequestEntry;
	sessionUid: number;
	tokenDigest: string | null;
	socketPath: string;
	teardown: VaultTeardownPaths;
	planned: boolean;
}

export type VaultRelayEvent = 'connect' | 'activity' | 'disconnect' | 'tick';

export interface VaultIssued {
	lease: string;
	claimBy: number;
	expiresAt: number;
}

/** What `harness credential attach --json` prints for connectOverCDP. */
export interface VaultAttachment {
	endpoint: string;
	headers: { Authorization: string };
	expiresAt: number;
}

export interface VaultLeaseEnded {
	lease: string;
	ended: string;
	teardown: VaultTeardownStep[];
}
