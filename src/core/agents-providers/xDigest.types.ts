// @harness-uid u_lvo5y6hhqv
export type XFeedKind = 'mentions' | 'following' | 'forYou';

export interface XPost {
	id: string;
	author: string;
	name: string;
	text: string;
	likes: number;
	reposts: number;
	replies: number;
}

export type XFeeds = Record<XFeedKind, XPost[]>;

/** Why X would not show a feed. Only a person can clear either one. */
export type XBlock = 'signed-out' | 'site-check';

export type XReadResult = { status: 'ok'; feeds: XFeeds } | { status: XBlock };

export interface XDigestState {
	version: 1;
	/** Newest last; bounded so the file stays small. */
	seen: string[];
	lastQueuedDay?: string;
	/** The problem Daniel was already told about, so one problem raises one question. */
	alerted?: string;
}

export interface XDigestConfig {
	profile: string;
	viewer: { url: string; port: number; hosts: string[] };
	/** Where finished digests wait for the sender. It holds no credential. */
	outbox?: string;
	tracker: { item: string; command: string };
	limits: { mentions: number; following: number; forYou: number; scan: number };
}

export interface XDigestReport {
	status: 'queued' | 'dry-run' | 'already-queued' | 'attended' | XBlock;
	counts?: Record<XFeedKind, number>;
}

/** One day's file in the outbox: either finished Slack messages, or why there are none yet. */
export type XDigestOutbox =
	| { version: 1; day: string; messages: string[] }
	| { version: 1; day: string; blocked: XBlock };
