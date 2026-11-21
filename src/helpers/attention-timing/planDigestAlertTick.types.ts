// @harness-uid u_uchh2rd6vl
/** One item from `tracker list --flagged --json`. Only the fields the digest reads are typed. */
export interface DigestItem {
	id: string;
	agent?: string | null;
	title?: string | null;
	question?: string | null;
	status?: string | null;
	needs_daniel?: boolean | null;
	deleted?: boolean | null;
}

/** `tick` builds the status message, `dry-run` builds it without persisting, `init` only records seen items. */
export type DigestAlertMode = 'tick' | 'dry-run' | 'init';

/** Inputs for one digest tick. Time is always passed in. */
export interface DigestAlertInput {
	nowMs: number;
	mode: DigestAlertMode;
	/** Parsed tracker digest, or null when the tracker could not be read this tick. */
	items: readonly DigestItem[] | null;
	/** Item ids reported by earlier ticks. */
	seenIds: readonly string[];
}

/** What one digest tick should do, as data. Delivery and persistence stay with the caller. */
export interface DigestAlertPlan {
	mode: DigestAlertMode;
	/** True when a tick falls in quiet hours and must not be delivered. */
	quietHeld: boolean;
	/** Status text to deliver, or null for init and quiet-hour skips. */
	message: string | null;
	/** Open needs-Daniel items in the digest. */
	flaggedCount: number;
	/** Ids of open items not in seenIds, sorted. */
	newIds: string[];
	/**
	 * Seen ids to persist once the message is delivered (immediately for init). Null when nothing
	 * may be persisted: dry runs, quiet-hour skips and unreadable tracker digests.
	 */
	nextSeenIds: string[] | null;
	/** One scheduler interval (30 minutes) after nowMs. */
	nextTickAtMs: number;
}
