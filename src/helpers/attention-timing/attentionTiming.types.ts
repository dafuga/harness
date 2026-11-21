// @harness-uid u_qtb3kzr5mh
/** Quiet-hours window in a named time zone. Start and end are "HH:MM" wall-clock times. */
export interface QuietHours {
	tz: string;
	start: string;
	end: string;
}

/** A wall-clock date and time in some time zone. */
export interface WallTime {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
}

/** A wall-clock time with seconds, as read back from a zone. */
export interface WallClock extends WallTime {
	second: number;
}

/** One attention event waiting for a batch. Times are epoch milliseconds. */
export interface AttentionLine {
	kind: string;
	itemId: string;
	atMs: number;
}

/** Lines grouped for one batch: newest per item and kind, in send order, with counts per kind. */
export interface AttentionBatch<T extends AttentionLine> {
	lines: T[];
	counts: Record<string, number>;
}

/** Everything needed to decide when the next attention batch may go out. */
export interface AttentionBatchTiming {
	nowMs: number;
	windowMs: number;
	paused: boolean;
	/** Catch-up after a resume: send now, ignoring the window and quiet hours. */
	forced: boolean;
	/** When the last send was attempted, or null if never. */
	lastAttemptMs: number | null;
	/** Queued lines, oldest first. Empty means nothing to send. */
	pending: ReadonlyArray<{ kind: string; createdAtMs: number }>;
	/** Kinds that skip the window (still held by quiet hours when quietHold is on). */
	urgentKinds: readonly string[];
	/** Kinds whose first line starts the window at the next window boundary. */
	windowAlignedKinds: readonly string[];
	quietHold: boolean;
	quiet: QuietHours | null | undefined;
}
