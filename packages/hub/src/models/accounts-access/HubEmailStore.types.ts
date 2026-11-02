import type { Actor } from 'collaboration';

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
