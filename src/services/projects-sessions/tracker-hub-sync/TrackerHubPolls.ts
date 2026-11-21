// @harness-uid u_jkomno4o5u
import type { TrackerHubStore } from '../TrackerHubSyncService.types';

/** Shares one journal subscription across all pending pull requests. */
export class TrackerHubPolls {
	readonly #pending = new Set<() => void>();
	#unsubscribe: (() => void) | undefined;

	constructor(private readonly subscribe: TrackerHubStore['subscribe']) {}

	wait(timeout: number, signal: AbortSignal | undefined): Promise<void> {
		return new Promise((resolve, reject) => {
			const done = () => {
				this.#pending.delete(done);
				clearTimeout(timer);
				signal?.removeEventListener('abort', done);
				try {
					this.#unsubscribeWhenIdle();
					resolve();
				} catch (error) {
					reject(error);
				}
			};
			const timer = setTimeout(done, timeout);
			this.#pending.add(done);
			signal?.addEventListener('abort', done, { once: true });
			if (signal?.aborted) {
				done();
				return;
			}
			if (this.#pending.size !== 1) return;
			try {
				this.#unsubscribe = this.subscribe(() => {
					for (const wake of this.#pending) wake();
				});
				// A store may report a change synchronously during subscription.
				this.#unsubscribeWhenIdle();
			} catch (error) {
				reject(error);
				done();
			}
		});
	}

	#unsubscribeWhenIdle(): void {
		if (this.#pending.size > 0) return;
		const unsubscribe = this.#unsubscribe;
		this.#unsubscribe = undefined;
		unsubscribe?.();
	}
}
