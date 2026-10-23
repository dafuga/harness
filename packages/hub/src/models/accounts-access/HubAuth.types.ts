import type { Actor } from 'collaboration';
import type { RepositoryIdentity } from 'collaboration';
import type { NATIVE_AUDIENCE } from './HubAuthValues';

export type HubEnvironment = 'local' | 'staging' | 'production';

/** Every value is optional. A missing or malformed value disables the feature that needs it. */
export interface AuthEnv {
	HARNESS_GOOGLE_CLIENT_ID?: string;
	HARNESS_SESSION_SECRET?: string;
	HARNESS_PUBLIC_ORIGIN?: string;
	HARNESS_ENVIRONMENT?: string;
	HARNESS_GITHUB_APP_ID?: string;
	HARNESS_GITHUB_PRIVATE_KEY?: string;
	HARNESS_GITHUB_CLIENT_ID?: string;
	HARNESS_GITHUB_CLIENT_SECRET?: string;
	HARNESS_COLLABORATION_REPOSITORY_ID?: string;
	HARNESS_COLLABORATION_INSTALLATION_ID?: string;
	HARNESS_EMAIL_API_KEY?: string;
	HARNESS_EMAIL_FROM?: string;
}

export interface InstallationTokenInput {
	installationId: number;
	repositoryIds: number[];
	permissions: { contents: 'read' | 'write' };
}

export interface HubAuth {
	/** Session cookie or `Authorization: Bearer`; null when absent, expired, revoked or out of scope. */
	actor(request: Request): Promise<Actor | null>;
	/** Answers only `/api/auth/*` and `/api/github/*`; null for every other path. */
	handle(request: Request): Promise<Response | null>;
	/** Re-proves GitHub admin and installation access on every call. Throws AuthFailure. */
	authorizeRepository(actor: Actor, repositoryId: number): Promise<RepositoryIdentity>;
	/** Server-side only. Write is limited to the configured collaboration repository. */
	token(input: InstallationTokenInput): Promise<string>;
}

export type AuthFailureCode =
	| 'auth-disabled'
	| 'auth-unavailable'
	| 'github-disabled'
	| 'invalid-request'
	| 'origin-denied'
	| 'challenge-invalid'
	| 'credential-invalid'
	| 'email-not-authoritative'
	| 'email-proof-required'
	| 'email-code-invalid'
	| 'email-rate-limited'
	| 'email-delivery-disabled'
	| 'email-delivery-failed'
	| 'session-required'
	| 'handoff-invalid'
	| 'github-not-connected'
	| 'github-unavailable'
	| 'repository-denied'
	| 'token-scope-denied'
	| 'not-found'
	| 'method-not-allowed';

/** A Google sign-in whose address still has to be proven. Present only while that is pending. */
export interface EmailProofStatus {
	email: string;
	/** True while a code that was sent can still be entered. */
	sent: boolean;
	/** When that code stops working. Null until one is sent. */
	expiresAt: string | null;
}

/** GET /api/auth/status */
export interface AuthStatus {
	actor: Actor | null;
	configured: boolean;
	clientId: string | null;
	emailProof?: EmailProofStatus;
}

/** POST /api/auth/google, /api/auth/email/start and /api/auth/email/verify response. */
export interface SignInResult {
	actor: Actor | null;
	emailProof?: EmailProofStatus;
}

export interface EmailProofMessage {
	email: string;
	code: string;
	expiresAt: string;
}

/** Sends a proof code to a mailbox. Resolves only once the provider accepted the message. */
export interface EmailProofDelivery {
	send(message: EmailProofMessage): Promise<void>;
}

/** POST /api/auth/challenge response. `nonce` goes to Google Identity Services. */
export interface AuthChallenge {
	nonce: string;
	csrf: string;
}

/** POST /api/auth/google body. */
export interface GoogleSignInInput {
	credential: string;
	csrf: string;
}

/** GET /api/github/status */
export interface GithubStatus {
	configured: boolean;
	connected: boolean;
	login: string | null;
}

/** One entry of GET /api/github/repositories. Installation ids never reach the client. */
export interface GithubRepositoryOption {
	id: number;
	owner: string;
	name: string;
	private: boolean;
}

export interface GithubRepositories {
	repositories: GithubRepositoryOption[];
	truncated: boolean;
}

/** POST /api/auth/native/start body. `resource` is `projects` or `project:<projectId>`. */
export interface NativeStartInput {
	challenge: string;
	nonce: string;
	resource: string;
}

export interface NativeStartResult {
	handoffId: string;
	userCode: string;
	verificationUrl: string;
	expiresAt: string;
	interval: number;
}

/** POST /api/auth/native/approve body, sent by the signed-in browser. */
export interface NativeApproveInput {
	handoffId: string;
	userCode: string;
}

/** POST /api/auth/native/poll response. Never carries a credential. */
export interface NativePollResult {
	status: 'pending' | 'approved' | 'expired';
	/** What is being asked for, so the approval page can show it before the user approves. */
	resource: string | null;
}

/** POST /api/auth/native/exchange body. Accepted once per handoff. */
export interface NativeExchangeInput {
	handoffId: string;
	verifier: string;
	nonce: string;
	resource: string;
}

/** Opaque, server-revocable. Keep `authorization` in OS-backed storage only. */
export interface NativeAuthorization {
	authorization: string;
	actor: Actor;
	audience: typeof NATIVE_AUDIENCE;
	resource: string;
	nonce: string;
	expiresAt: string;
}
export { EMAIL_CODE_LENGTH, NATIVE_AUDIENCE, NATIVE_ACTION } from './HubAuthValues';
