export interface QueuedRequestFlags {
	approvalOnly?: boolean;
	deferredOtp?: boolean;
	codeOnly?: boolean;
	selectionId?: string;
	websiteDomain?: string;
	requireServiceOtp?: boolean;
}

export interface SavedLogin {
	domain?: string;
	password: string;
	twoFactorEveryTime?: boolean;
}

export interface SealedApproval {
	senderPublicKey: string;
	salt: string;
	ciphertext: string;
}

export interface PhoneDecision {
	refused?: string;
	decision?: string;
	sealed?: SealedApproval;
	[field: string]: unknown;
}
