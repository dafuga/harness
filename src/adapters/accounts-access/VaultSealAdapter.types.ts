// @harness-uid u_cepoq63qyy
import type { VaultSealed } from '../../validators/accounts-access/VaultWireValidator.types';

/** The scope a CB-DEVICE-V2 approval signature covers beyond the V1 fields. */
export interface VaultApprovalBinding {
	recipeDigest: string;
	runnerFingerprint: string;
	method: 'api-token' | 'oauth-device' | 'browser';
	mode: 'read' | 'write';
	leaseMs: number;
}

/** A login runner's ephemeral X25519 key; open() works once. */
export interface VaultRunnerKey {
	publicKey: string;
	fingerprint: string;
	open(requestId: string, sealed: VaultSealed): Buffer;
}
