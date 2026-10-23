/** One process as the system names it: reused ids differ in their start time. */
export interface TrackedProcess {
	pid: number;
	started: string;
}

export interface ProcessRow extends TrackedProcess {
	parent: number;
	group: number;
}

/** A process of the command that still exists. */
export interface FollowedProcess extends ProcessRow {
	/** The parent it had when it was first seen, by id and start time; null when none was seen. */
	origin: TrackedProcess | null;
	/** False when only the number of its group points at the command: that shows nothing. */
	proven: boolean;
}

export type ProcessTable = () => Promise<ProcessRow[] | null>;

export type Row = ProcessRow;

export interface Owned {
	started: string;
	origin: TrackedProcess | null;
	byParent: boolean;
}

/** What is known of one command. Everything is held by id and start time together. */
export interface Following {
	root: number;
	rootStarted: string | null;
	/** The command has not been reaped: its id can be no other process. */
	open: boolean;
	owned: Map<number, Owned>;
}

/** What follows one command. */
export interface Descendants {
	/** Looks once; overlapping looks are skipped. */
	look(): Promise<void>;
	/** Processes followed by their parents that still exist, the command itself excluded. */
	survivors(): Promise<TrackedProcess[]>;
	/**
	 * The command, what it started and the members of its group, as far as they still exist,
	 * and strangers in its group marked as not proven. Null when the processes could not be
	 * read: nothing is known then, not that none is left.
	 */
	alive(): Promise<FollowedProcess[] | null>;
	/**
	 * The command has ended and was reaped: from now on its id may be another process. It looks
	 * once more for what the command's own have started; nothing is owned for its group alone.
	 */
	closed(): void;
}
