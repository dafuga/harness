/** How the window's bridge answers: a ready snapshot, a refused read, or no overview operation. */
export type OverviewBridge = 'ready' | 'refused' | 'absent' | 'web';

/** The fixed tracker GET paths the main-process double answers, keyed by the read they serve. */
export type TrackerReadKey = 'items' | 'runs' | 'machines';

/** One request the main-process tracker double saw, with how it was answered. */
export type TrackerRequestRecord = {
	method: string;
	url: string;
	outcome: 'answered' | 'unreachable' | 'refused';
};

/** Synthetic raw tracker payloads and the mode the double answers them in. */
export type TrackerDouble = {
	mode: 'ready' | 'down';
	origin: string;
	urls: Record<TrackerReadKey, string>;
	payloads: Record<TrackerReadKey, unknown[]>;
};
