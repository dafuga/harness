// @harness-uid u_r4ajdppn52
import type {
	SealedChainEntry,
	SealedChainPin,
	SealedDeviceKeys,
	SealedGrant
} from '../../models/networking-security/Sealed.types';
import type { SealedSessionRequest } from '../../utils/networking-security/readSealedDeviceSession.types';

export interface EnrollmentReviewOptions {
	account: string;
	device: SealedDeviceKeys;
	/** The local head verified when this installation was admitted. */
	pin: SealedChainPin;
	/** Cancel on sign-out or account change, including during the local presence check. */
	signal: AbortSignal;
	request: SealedSessionRequest;
}

export interface MailboxStep {
	n: number;
	by: string;
	body: string;
}
export interface EnrollmentMailbox {
	id: string;
	steps: MailboxStep[];
}
export interface EnrollmentOpening {
	kemPublic: string;
	signingPublic: string;
	commit: string;
}
export interface EnrollmentPublication {
	entry: SealedChainEntry;
	grants: SealedGrant[];
	pin: SealedChainPin;
}
