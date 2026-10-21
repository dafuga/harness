import type { AuthStatus, SignInResult } from '../../models/accounts-access/HubAuth.types';
import type { BrowserApi } from '../browserApi';

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

/** Sign-in as the page sees it. The server alone decides who is signed in. */
export function browserAuth(api: BrowserApi) {
	return {
		status: () => api.get<AuthStatus>('/api/auth/status'),
		challenge: () => api.send<LoginChallenge>('POST', '/api/auth/challenge'),
		google: (credential: string, csrf: string) =>
			api.send<SignInResult>('POST', '/api/auth/google', { credential, csrf }),
		/** Asks the server to send a code to the pending address. Only a person's click calls this. */
		emailStart: () => api.send<SignInResult>('POST', '/api/auth/email/start'),
		/** The typed code travels in the body; the pending proof is the browser's own cookie. */
		emailVerify: (code: string) =>
			api.send<SignInResult>('POST', '/api/auth/email/verify', { code }),
		logout: () => api.send<{ ok: boolean }>('POST', '/api/auth/logout'),
		nativeRequest: (handoffId: string) =>
			api.send<NativeRequest>('POST', '/api/auth/native/poll', { handoffId }),
		/** The typed code travels in the body; the signed-in browser session is the approver. */
		nativeApprove: (handoffId: string, userCode: string) =>
			api.send<{ approved: boolean; resource: string }>('POST', '/api/auth/native/approve', {
				handoffId,
				userCode
			})
	};
}
export type BrowserAuth = ReturnType<typeof browserAuth>;
