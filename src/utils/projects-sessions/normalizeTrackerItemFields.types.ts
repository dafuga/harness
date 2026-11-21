/** One wall-clock reading for the entire plan, plus a caller-supplied launch nonce if needed. */
export interface TrackerItemClock {
	readonly node: string;
	readonly now: number;
	readonly timeZone?: string;
	readonly launchNonce?: string;
}

export type TrackerItemInput = Readonly<Record<string, unknown>>;
export type TrackerItemFields = Record<string, string | number | null>;
