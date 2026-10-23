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
