// @harness-uid u_reqbbzj5we
import type {
	RealtimeState,
	TrackerChangeEvent
} from '$reports/lib/projects-sessions/realtime/realtime.types';

import { MissingChangeFeedError } from './MissingChangeFeedError';

const changesUrl = 'http://127.0.0.1:7701/changes';
const waitSeconds = 25;
const maxRetryMs = 2000;

/**
 * Main-process follower of the local tracker's change feed. It always asks from the last cursor
 * it saw, so changes made while the tracker or the link was down are reported on reconnect.
 */
export class TrackerChangeWatcher {
	private cursor: string | null = null;
	private state: RealtimeState = 'reconnecting';
	private failures = 0;
	private readonly lifetime = new AbortController();

	constructor(private readonly listener: (event: TrackerChangeEvent) => void) {}

	start(): this {
		void this.follow();
		return this;
	}

	stop(): void {
		this.lifetime.abort();
	}

	private async follow(): Promise<void> {
		while (!this.lifetime.signal.aborted) {
			try {
				this.advance(await this.read());
			} catch {
				if (this.lifetime.signal.aborted) return;
				await this.back();
			}
		}
	}

	/** The first request after a failure does not wait, so the link is known to be back at once. */
	private async read(): Promise<string> {
		const wait = this.state === 'live' ? waitSeconds : 0;
		const query = this.cursor ? `?cursor=${encodeURIComponent(this.cursor)}&wait=${wait}` : '';
		const response = await fetch(changesUrl + query, {
			redirect: 'error',
			cache: 'no-store',
			signal: AbortSignal.any([this.lifetime.signal, AbortSignal.timeout((wait + 5) * 1000)])
		});
		const body = response.ok ? ((await response.json()) as { cursor?: unknown }) : {};
		if (typeof body.cursor !== 'string') throw new MissingChangeFeedError('No tracker change feed');
		return body.cursor;
	}

	private advance(cursor: string): void {
		const changed = this.cursor !== null && cursor !== this.cursor;
		const reconnected = this.state !== 'live';
		this.cursor = cursor;
		this.state = 'live';
		this.failures = 0;
		if (changed || reconnected) this.listener({ state: 'live', changed });
	}

	private async back(): Promise<void> {
		if (this.state === 'live') {
			this.state = 'reconnecting';
			this.listener({ state: 'reconnecting', changed: false });
		}
		const delay = Math.min(200 * 2 ** this.failures++, maxRetryMs);
		await new Promise<void>((resolve) => {
			const done = () => {
				clearTimeout(timer);
				this.lifetime.signal.removeEventListener('abort', done);
				resolve();
			};
			const timer = setTimeout(done, delay);
			this.lifetime.signal.addEventListener('abort', done);
		});
	}
}
