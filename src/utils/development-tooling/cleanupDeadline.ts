import { clearTimeout, setTimeout } from 'node:timers';

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

export function cleanupDeadline(milliseconds: number): CleanupDeadline {
	const control = new AbortController();
	const limit = setTimeout(() => control.abort(), milliseconds);
	const over = new Promise<void>((done) => {
		control.signal.addEventListener('abort', () => done(), { once: true });
	});
	limit.unref();
	return {
		signal: control.signal,
		expired: () => control.signal.aborted,
		within<T>(work: Promise<T>, fallback: T): Promise<T> {
			const answered = work.catch(() => fallback);
			if (control.signal.aborted) return Promise.resolve(fallback);
			return Promise.race([answered, over.then(() => fallback)]);
		},
		async pause(wait: number): Promise<void> {
			let timer: ReturnType<typeof setTimeout> | undefined;
			const waited = new Promise<void>((done) => {
				timer = setTimeout(done, wait);
			});
			await Promise.race([waited, over]);
			clearTimeout(timer);
		},
		cancel(): void {
			clearTimeout(limit);
			control.abort();
		}
	};
}
