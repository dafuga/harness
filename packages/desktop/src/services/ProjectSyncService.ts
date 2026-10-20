/** What one surface reads again to stay current, and how often while it is shown. */
export interface ProjectSyncOptions {
	/** One read of who is signed in and of their projects; it reports its own failures. */
	refresh: () => Promise<unknown>;
	/** Milliseconds between reads while the surface is shown; half a minute by default. */
	interval?: number;
}

/**
 * Keeps one surface's projects current: a read on focus, on becoming visible and on coming back
 * online, and one per interval while it is shown. Reads never overlap: asking during a read gets
 * one more read after it, however often it is asked. Hidden or stopped, no timer is left, and
 * without a page (a test or a server render) only the interval reads.
 */
export class ProjectSyncService {
	private timer: ReturnType<typeof setTimeout> | undefined;
	private running: Promise<void> | null = null;
	private again = false;
	private active = false;
	private release: (() => void) | undefined;
	constructor(private options: ProjectSyncOptions) {}
	/** Listens and waits one interval: the read that showed the surface is its owner's. */
	start() {
		if (this.active) return;
		this.active = true;
		this.release = this.listen();
		this.schedule();
	}
	stop() {
		this.active = false;
		this.again = false;
		this.clear();
		this.release?.();
		this.release = undefined;
	}
	/** Reads now; while a read is under way, once more after it. */
	sync(): Promise<void> {
		if (!this.active || !this.shown) return Promise.resolve();
		if (this.running) {
			this.again = true;
			return this.running;
		}
		this.clear();
		this.running = this.run();
		return this.running;
	}
	private async run(): Promise<void> {
		try {
			await this.options.refresh();
		} catch {
			/* The owner reports its failure; the next read is scheduled all the same. */
		} finally {
			this.running = null;
		}
		if (this.again && this.active) {
			this.again = false;
			return this.sync();
		}
		this.schedule();
	}
	private schedule() {
		this.clear();
		if (!this.active || !this.shown) return;
		this.timer = setTimeout(() => void this.sync(), this.options.interval ?? 30000);
	}
	private clear() {
		clearTimeout(this.timer);
		this.timer = undefined;
	}
	private get shown() {
		return globalThis.document?.visibilityState !== 'hidden';
	}
	/** Focus and a regained connection read at once; becoming hidden ends the interval. */
	private listen() {
		const view = globalThis.window;
		const page = globalThis.document;
		if (!view?.addEventListener || !page?.addEventListener) return undefined;
		const now = () => void this.sync();
		const changed = () => (this.shown ? now() : this.schedule());
		view.addEventListener('focus', now);
		view.addEventListener('online', now);
		page.addEventListener('visibilitychange', changed);
		return () => {
			view.removeEventListener('focus', now);
			view.removeEventListener('online', now);
			page.removeEventListener('visibilitychange', changed);
		};
	}
}
