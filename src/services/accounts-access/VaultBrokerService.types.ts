// @harness-uid u_hfim4j5obl
import type {
	VaultProof,
	VaultSessionRequest
} from '../../validators/accounts-access/VaultWireValidator.types';

export type VaultRequestStatus =
	| 'pending'
	| 'approved'
	| 'executing'
	| 'completed'
	| 'failed'
	| 'denied'
	| 'delivered'
	| 'expired'
	| 'canceled';

/** One request as the broker holds it; the receipt is stored only as a digest. */
export interface VaultRequestEntry {
	id: string;
	input: VaultSessionRequest;
	uid: number | null;
	receiptDigest: string;
	runnerFingerprint: string;
	status: VaultRequestStatus;
	expiresAt: number;
	approval?: { proof: VaultProof; expiresAt: number };
	generatePassword?: () => Promise<void>;
}

export type VaultPasswordPreparation = (
	request: VaultSessionRequest
) => VaultRequestEntry['generatePassword'];

export interface VaultCreated {
	requestId: string;
	receipt: string;
	expiresAt: number;
	runnerFingerprint: string;
}

/** What Harness iOS shows on the approval screen before Face ID. */
export interface VaultQueueEntry {
	requestId: string;
	item: string;
	session: string;
	project: string;
	environment: string;
	site: string;
	action: string;
	account: string;
	mode: 'read' | 'write';
	method: VaultSessionRequest['method'];
	recipe: VaultSessionRequest['recipe'] & { display: string };
	host: string;
	runnerPublicKey: string;
	runnerFingerprint: string;
	origins: string[];
	leaseMs: number;
	reason: string;
	expiresAt: number;
}
