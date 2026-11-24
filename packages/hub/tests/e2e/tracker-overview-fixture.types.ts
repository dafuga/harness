/** How the owner endpoint answers in one test. `held` keeps the read in flight until released. */
export type OverviewMode =
	| 'ready'
	| 'empty'
	| 'unavailable'
	| 'stale'
	| 'host-revoked'
	| 'denied'
	| 'held';

/** One request the page made to the owner endpoint, without any header or body. */
export interface OverviewCall {
	method: string;
	path: string;
	query: string;
}

export interface OverviewControl {
	mode: OverviewMode;
	calls: OverviewCall[];
	/** Lets a `held` read finish; the page then shows what the endpoint answered. */
	release: () => void;
}

export interface Viewport {
	id: string;
	width: number;
	height: number;
}
