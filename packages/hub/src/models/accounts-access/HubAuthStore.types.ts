// @harness-uid u_d3q2svhmgn
import type { EmailProofStore, EmailLedgerStore } from './HubEmailStore.types';
import type { Actor } from 'collaboration';
import type { AccountDevice, HubEnvironment, NativeCallback } from './HubAuth.types';

/** Times are epoch milliseconds. `idHash` is a keyed hash; the secret itself is never stored. */
export interface ChallengeRecord {
	idHash: string;
	nonce: string;
	csrfHash: string;
	expiresAt: number;
}

export type SessionKind = 'browser' | 'native';

export interface SessionRecord {
	device?: AccountDevice;
	idHash: string;
	kind: SessionKind;
	/** What the session came from: the approving browser session, or a pending email proof. */
	parentHash: string | null;
	actor: Actor;
	/** `projects` or `project:<projectId>`. */
	resource: string;
	createdAt: number;
	expiresAt: number;
	revokedAt: number | null;
}

export interface GithubStateRecord {
	idHash: string;
	sessionHash: string;
	actorId: string;
	/** The actor's grant generation when the flow began. The callback publishes only against it. */
	grantGeneration: number;
	/** AES-GCM sealed PKCE verifier. */
	verifierCipher: string;
	expiresAt: number;
}

export interface GithubGrantRecord {
	actorId: string;
	githubUserId: number;
	login: string;
	/** AES-GCM sealed user access token, bound to the actor as additional data. */
	tokenCipher: string;
	tokenExpiresAt: number | null;
	refreshCipher: string | null;
	refreshExpiresAt: number | null;
	createdAt: number;
	expiresAt: number;
}

export type NativeExchangeStatus = 'pending' | 'approved' | 'consumed';

export interface NativeExchangeRecord {
	callback?: NativeCallback;
	deviceName?: string;
	id: string;
	/** base64url SHA-256 of the desktop's PKCE verifier. */
	challenge: string;
	nonceHash: string;
	codeHash: string;
	resource: string;
	audience: string;
	action: string;
	environment: HubEnvironment;
	origin: string;
	status: NativeExchangeStatus;
	/** Actor id of the approver; set by approve. */
	subject: string | null;
	parentHash: string | null;
	expiresAt: number;
}

export interface NativeApproval {
	callbackCodeHash?: string;
	callbackExpiresAt?: number;
	id: string;
	codeHash: string;
	subject: string;
	parentHash: string;
	now: number;
}

export interface OneTimeStore<T> {
	create(record: T): Promise<void>;
	/** Atomically removes and returns an unexpired record. A second caller receives null. */
	claim(idHash: string, now: number): Promise<T | null>;
}

export interface SessionStore {
	devices(actorId: string, now: number): Promise<AccountDevice[]>;
	removeDevice(actorId: string, deviceId: string, now: number): Promise<boolean>;
	touchDevice(idHash: string, now: number): Promise<void>;
	create(record: SessionRecord): Promise<void>;
	find(idHash: string): Promise<SessionRecord | null>;
	/** Revokes the session and every native session it approved. */
	revoke(idHash: string, now: number): Promise<void>;
}

export interface GrantState {
	/** Advanced by every connection and revocation, never reused. 0 while the actor has no row. */
	generation: number;
	/** Null when the actor never connected or the grant was revoked. */
	grant: GithubGrantRecord | null;
	/** While in the future, one caller holds the sole right to rotate the tokens. */
	refreshingUntil: number | null;
}

export interface GrantLease {
	actorId: string;
	generation: number;
	now: number;
	until: number;
}

/** Every write is one conditional statement. Nothing here reads and then writes. */
export interface GrantStore {
	read(actorId: string): Promise<GrantState>;
	/** Publishes a connection only while the generation is still `expected`, and advances it. */
	connect(expected: number, record: GithubGrantRecord): Promise<boolean>;
	/** Claims the rotation of a live grant of that generation, if nobody holds an unexpired claim. */
	lease(lease: GrantLease): Promise<boolean>;
	/** Stores rotated tokens only for the holder of that lease. The grant's lifetime is kept. */
	rotate(lease: GrantLease, record: GithubGrantRecord): Promise<boolean>;
	/** Erases the tokens, leaves a tombstone and advances the generation. Unconditional. */
	revoke(actorId: string, now: number): Promise<void>;
	/** The same, but only for the holder of that lease. */
	revokeLeased(lease: GrantLease, now: number): Promise<boolean>;
}

export interface ExchangeStore {
	create(record: NativeExchangeRecord): Promise<void>;
	find(id: string): Promise<NativeExchangeRecord | null>;
	/** pending to approved, only with the matching user code. False when nothing changed. */
	approve(approval: NativeApproval): Promise<boolean>;
	/** approved to consumed exactly once. A concurrent or repeated caller receives null. */
	claim(id: string, now: number): Promise<NativeExchangeRecord | null>;
}

/**
 * Credentials and one-time state only. Projects, members and comments live in GitHub. A grant
 * row is the one thing that is kept: without its tokens, as the carrier of the generation.
 */
export interface AuthStore {
	challenges: OneTimeStore<ChallengeRecord>;
	githubStates: OneTimeStore<GithubStateRecord>;
	sessions: SessionStore;
	grants: GrantStore;
	exchanges: ExchangeStore;
	emailProofs: EmailProofStore;
	emailLedger: EmailLedgerStore;
	/** Deletes expired rows and tombstones expired grants. Safe to call from a scheduled handler. */
	purge(now: number): Promise<void>;
}
export type * from './HubEmailStore.types';
