import type { CleanupDeadline } from './cleanupDeadline.types';
import { clearTimeout, setTimeout } from 'node:timers';

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

export type { CleanupDeadline } from './cleanupDeadline.types';
