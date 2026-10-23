import type { browserAuth } from './browserAuth';

export interface LoginChallenge {
	/** Given to Google Identity Services, which returns it inside the signed credential. */
	nonce: string;
	/** Sent back with the credential, in the body. */
	csrf: string;
}

/** What a desktop app that waits for approval asks for; `resource` names its scope. */
export interface NativeRequest {
	status: 'pending' | 'approved' | 'expired';
	resource: string | null;
}

export type BrowserAuth = ReturnType<typeof browserAuth>;
