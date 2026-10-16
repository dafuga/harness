export type PowerEvent = 'suspend' | 'resume' | 'lock-screen' | 'unlock-screen';
/** Electron's powerMonitor in the app; an emitter in tests. */
export interface PowerPort {
	on(event: PowerEvent, listener: () => void): unknown;
}
export interface RemoteLifecycleOptions {
	power: PowerPort;
	host: {
		enabled(): boolean;
		suspend(): void;
		resume(): void;
		stop(): Promise<unknown> | void;
	};
	/** Cancels the runs of the desktop window. Runs of phones are not touched by it. */
	cancelLocal: () => void;
	/** Told when the screen is locked or unlocked, so phones can be shown the fact. */
	screen?: (locked: boolean) => void;
}

/**
 * What screen, power and window events mean for remote access. A locked screen means nothing:
 * the main process, its socket and its runs go on. Only real suspension takes the host offline.
 * No sleep setting of the system is ever changed here.
 */
export class RemoteLifecycleService {
	locked = false;
	suspended = false;
	private ended = false;
	constructor(private readonly options: RemoteLifecycleOptions) {}
	start(): void {
		const { power } = this.options;
		power.on('lock-screen', () => this.screen(true));
		power.on('unlock-screen', () => this.screen(false));
		power.on('suspend', () => this.suspend());
		power.on('resume', () => this.resume());
	}
	/** Closing the last window ends the app only when no phone depends on it. */
	windowsClosed(): 'keep' | 'quit' {
		this.options.cancelLocal();
		return this.options.host.enabled() ? 'keep' : 'quit';
	}
	/** Quit is explicit: the remote backend ends and so does every run. */
	async quit(): Promise<void> {
		if (this.ended) return;
		this.ended = true;
		this.options.cancelLocal();
		await this.options.host.stop();
	}
	private screen(locked: boolean): void {
		this.locked = locked;
		this.options.screen?.(locked);
	}
	private suspend(): void {
		if (this.suspended) return;
		this.suspended = true;
		this.options.host.suspend();
	}
	private resume(): void {
		if (!this.suspended) return;
		this.suspended = false;
		this.options.host.resume();
	}
}
