import type { Actor } from 'collaboration';
import type { HubEnvironment } from './HubAuth.types';

/** Times are epoch milliseconds. `idHash` is a keyed hash; the secret itself is never stored. */
export interface ChallengeRecord {
	idHash: string;
	nonce: string;
	csrfHash: string;
	expiresAt: number;
}

export type SessionKind = 'browser' | 'native';

export interface SessionRecord {
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

export interface EmailProofRecord {
	idHash: string;
	/** Who the Google credential identified. An actor only once the mailbox is proven. */
	actor: Actor;
	codeHash: string | null;
	codeExpiresAt: number | null;
	attempts: number;
	claimed: boolean;
	expiresAt: number;
}

export interface EmailCodeIssue {
	idHash: string;
	codeHash: string;
	codeExpiresAt: number;
	now: number;
}

export interface EmailCodeAttempt {
	idHash: string;
	codeHash: string;
	limit: number;
	now: number;
}

export interface EmailProofStore {
	create(record: EmailProofRecord): Promise<void>;
	find(idHash: string): Promise<EmailProofRecord | null>;
	/** Replaces the code of a live, unclaimed proof and gives it a fresh set of attempts. */
	issue(issue: EmailCodeIssue): Promise<boolean>;
	/** One statement: spends an attempt and claims the proof on a match. Null when none is left. */
	attempt(attempt: EmailCodeAttempt): Promise<EmailProofRecord | null>;
	/** Removes a claimed proof, once: the last gate before its session is handed out. */
	finish(idHash: string): Promise<boolean>;
	remove(idHash: string): Promise<void>;
}

export interface EmailSendWindow {
	key: string;
	now: number;
	day: number;
	/** A send is refused while the last one for the key is later than this. */
	since: number;
	cap: number;
}

export interface VerifiedEmailRecord {
	actorId: string;
	emailHash: string;
	verifiedAt: number;
	expiresAt: number;
}

export interface EmailLedgerStore {
	/** Counts one send for the key, unless one is too recent or the day's cap is reached. */
	allow(window: EmailSendWindow): Promise<boolean>;
	proven(actorId: string): Promise<VerifiedEmailRecord | null>;
	prove(record: VerifiedEmailRecord): Promise<void>;
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
