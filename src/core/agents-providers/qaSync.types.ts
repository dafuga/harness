// @harness-uid u_3d6jytdefh
/** Per-project QA thread sync configuration. Credentials never belong in it. */
export interface QaSyncConfig {
	project: string;
	slack: { workspaceId: string; channels: string[] };
	github: { owner: string; repo: string };
	/** A QA thread is a parent by one of these Slack user or bot ids whose heading names an issue. */
	threads: { authors: string[]; headingMarker: string };
	testers: { slackUser: string; name: string }[];
	approval: { reactions: string[]; label: string };
	retest: {
		label: string;
		/** Environment name to the words that mean it in a message. */
		environments: Record<string, string[]>;
		defaultEnvironment: string;
		/** Slack user or bot ids, besides the testers, whose retest requests count. */
		requesters: string[];
	};
	/** Comments go to the one open item naming the issue, otherwise to the inbox item. */
	tracker: { agent: string; inboxItem: string };
	lookbackDays: number;
}

export interface QaSlackMessage {
	ts: string;
	text: string;
	user?: string;
	botId?: string;
	subtype?: string;
	replyCount?: number;
	latestReply?: string;
	reactions?: { name: string; count: number; users: string[] }[];
}

export interface QaSlackReader {
	identity(): Promise<{ workspaceUrl: string }>;
	history(channel: string, oldest: string): Promise<QaSlackMessage[]>;
	/** The parent followed by every reply, oldest first. Empty when the thread is gone. */
	replies(channel: string, parentTs: string): Promise<QaSlackMessage[]>;
}

export interface QaIssueLabels {
	/** `undefined` when the number is missing or is a pull request. */
	labels(issue: number): Promise<string[] | undefined>;
	/** Additive only: existing labels are never removed or replaced. */
	addLabel(issue: number, label: string): Promise<void>;
}

export interface QaTrackerItem {
	id: string;
	title: string;
}

export interface QaTrackerNotes {
	openItems(): Promise<QaTrackerItem[]>;
	note(id: string, text: string): Promise<void>;
}

export interface QaThreadState {
	channel: string;
	parentTs: string;
	issue: number;
	/** Newest reply already handled. */
	cursor: string;
	/** Testers whose current check mark has already been applied. */
	approved: string[];
}

export interface QaSyncState {
	version: 1;
	/** Replies at or before this Slack timestamp predate the first run. */
	since: string;
	threads: Record<string, QaThreadState>;
}

export interface QaSyncStore {
	load(): Promise<QaSyncState | undefined>;
	save(state: QaSyncState): Promise<void>;
}

export type QaSyncAction =
	| { kind: 'label'; issue: number; label: string; reason: 'approval' | 'retest'; by: string }
	| { kind: 'note'; issue: number; item: string; text: string };

export interface QaSyncReport {
	dryRun: boolean;
	threads: number;
	actions: QaSyncAction[];
	warnings: string[];
	errors: string[];
}

export interface QaSyncOptions {
	dryRun?: boolean;
	/** On the first run, also treat replies already in the lookback window as new. */
	backfillComments?: boolean;
}
