// @harness-uid u_4uztsikiqd
import type { ScopeKeys, SealedChainPin } from '../../models/networking-security/Sealed.types';

export interface EnrollmentClaimPin {
	mailbox: string;
	approver: string;
	nonce: string;
	signingPublic: string;
	head: SealedChainPin;
}

export interface EnrollmentProgress {
	nonce: Uint8Array;
	mailbox?: string;
	claim?: EnrollmentClaimPin;
	/** Monotonic history remembered across sign-out, separate from approval of these keys. */
	accountPin?: SealedChainPin;
	pin?: SealedChainPin;
}

export interface ApprovedInstallation {
	state: 'approved';
	pin: SealedChainPin;
	keys: ScopeKeys[];
}

export type EnrollmentResolution =
	| { state: 'first-device' | 'approval-denied' | 'approval-expired' }
	| { state: 'waiting-for-approval'; code: string | null }
	| ApprovedInstallation;

export type KeepEnrollmentProgress = (progress: EnrollmentProgress) => Promise<void>;
