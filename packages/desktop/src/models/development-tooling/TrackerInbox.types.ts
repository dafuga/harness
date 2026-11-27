// @harness-uid u_xh7uht2d3a
import type { TrackerChangeEvent } from '$reports/lib/projects-sessions/realtime/realtime.types';

import type {
	TrackerPlanning,
	TrackerStage
} from '../../../../../src/utils/projects-sessions/trackerPlanning.types';

/** The buckets an item can sit in. Needs you comes first: an open flag always wins. */
import type {
	TrackerAttachment,
	TrackerAttachmentDocument
} from '../../../../../src/utils/projects-sessions/trackerAttachment.types';

export type InboxBucket = 'needs-you' | 'blocked' | 'active' | 'quiet' | 'done';
export type InboxFilter = 'all' | InboxBucket | 'reminders';

/** `done` and `remind` (snooze) are the two taps on a reminder. */
export type WriteAction = 'note' | 'flag' | 'answer' | 'done' | 'remind';

/** One item's header as the phone replica holds it. */
export interface InboxHeader {
	id: string;
	title: string;
	project: string;
	status: string;
	stage?: TrackerStage;
	updatedAt: string | null;
	dueAt: string | null;
	/** Set on an active personal item: when it reminds next. */
	reminder?: { at: string; repeats: string | null };
}

/** One tappable answer to an open ask. `recommended` is the one the asking session suggests. */
export interface InboxOption {
	label: string;
	effect: string;
	recommended?: true;
}

export type InboxConfirmKind = 'deploy' | 'money' | 'secret';

export type InboxAttachment = TrackerAttachment & { content?: TrackerAttachmentDocument };

export interface InboxFlag {
	state: string;
	at: string | null;
	question: string;
	options?: InboxOption[];
	/** Deploy, money and secret asks need an extra confirm step (Face ID on the phone). */
	confirm?: InboxConfirmKind;
	/** Specs and documents behind "View spec". */
	attachments?: InboxAttachment[];
}

export interface InboxNote {
	id: string;
	author: string;
	at: string;
	text: string;
}

/** A run summary. Only lifecycle and outcome travel; no command lines or transcripts. */
export interface InboxRun {
	id: string;
	origin: string;
	state: string;
	outcome: string | null;
	queuedAt: number | null;
	startedAt: number | null;
	endedAt: number | null;
}

export interface InboxRow {
	header: InboxHeader;
	bucket: InboxBucket;
	/** The open structured ask of a Needs you row: its question and when it was raised. */
	ask?: { question: string; since: string | null };
	/** The item behind a Needs you row, read for its choices. Its revision is what a tap answers. */
	review?: InboxDetail;
}

export interface InboxDetail {
	header: InboxHeader;
	planning?: TrackerPlanning;
	notes: InboxNote[];
	flag: InboxFlag | null;
	runs: InboxRun[];
	/** The attention revision the user reviews. A flag write must carry the one it was shown. */
	revision: string | null;
}

/** The reviewed copy of an item, kept by the page until the write is confirmed or dropped. */
export interface InboxReview {
	itemId: string;
	revision: string | null;
}

export type WriteState = 'pending' | 'acknowledged' | 'conflict' | 'rejected';

/** One entry of the phone's protected write outbox, as `tracker_write_status` reports it. */
export interface InboxWrite {
	intentId: string;
	itemId: string;
	status: 'queued' | 'conflict' | 'accepted';
	reason: string;
}

export interface InboxWriteView {
	intentId: string;
	itemId: string;
	state: WriteState;
	label: string;
	discardable: boolean;
}

export type ReviewGate =
	| { allowed: true }
	| { allowed: false; reason: 'answered' | 'already-open' | 'unreviewed' | 'changed' | 'no-flag' };

/** A write the user confirmed. Built only after an explicit confirmation. */
export interface ConfirmedWrite {
	action: WriteAction;
	id: string;
	text: string;
	revision: string | null;
	/** The 1-based number of the tapped option; `text` is then that option's label. */
	option?: number;
	/** A reminder tap names the armed time it was shown; a snooze's `text` is the new time. */
	armed?: string;
}

export interface InboxWriteReceipt {
	intentId?: string;
	status: string;
}

export type InboxFreshness = 'current' | 'stale' | 'unavailable';

/** The result of one read or write, with the freshness the phone reported for it. */
export interface InboxReply<T> {
	value?: T;
	code?: string;
	freshness: InboxFreshness;
	lastSyncedAt: string | null;
	partial: boolean;
	candidates?: string[];
}

export interface InboxOverview {
	rows: InboxRow[];
	/** Personal reminders, soonest first. */
	reminders: InboxHeader[];
	unresolvedFlags: number;
	/** True when the phone returned its full cap of Needs you items, so more may exist. */
	needsYouCapped: boolean;
}

/** The reads and confirmed writes supplied by the Mac bridge or the phone replica. */
export interface TrackerInboxSource {
	overview(): Promise<InboxReply<InboxOverview>>;
	search(query: string): Promise<InboxReply<InboxRow[]>>;
	detail(id: string): Promise<InboxReply<InboxDetail>>;
	/** One document of the open ask, where `detail` does not already carry the text (the phone). */
	document?(itemId: string, attachmentId: string): Promise<InboxReply<TrackerAttachmentDocument>>;
	write(write: ConfirmedWrite): Promise<InboxReply<InboxWriteReceipt>>;
	writes(): Promise<InboxReply<InboxWrite[]>>;
	discard(intentId: string): Promise<InboxReply<unknown>>;
	/** Pushed tracker changes. Absent where a source cannot push; the screen then reads on demand. */
	watch?(listener: (event: TrackerChangeEvent) => void): () => void;
}
