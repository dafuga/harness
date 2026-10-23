/**
 * One bound for a piece of cleanup, shared by everything that works under it: reads are raced
 * against it, pauses end with it, and whoever is about to act asks it first. Once it is over,
 * because its time is up or because the cleanup is done, it stays over.
 */
export interface CleanupDeadline {
	/** Aborted when the deadline is over; given to whatever can be cancelled. */
	readonly signal: AbortSignal;
	expired(): boolean;
	/** The answer of the work, or the fallback when the work is late or fails. */
	within<T>(work: Promise<T>, fallback: T): Promise<T>;
	/** Waits that long, or until the deadline is over. */
	pause(milliseconds: number): Promise<void>;
	/** Ends it now: nothing under it may act any more. */
	cancel(): void;
}
