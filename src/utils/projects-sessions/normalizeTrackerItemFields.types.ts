// @harness-uid u_dv4lnm54rz
/** One wall-clock reading for the entire plan, plus a caller-supplied launch nonce if needed. */
export interface TrackerItemClock {
	readonly node: string;
	readonly now: number;
	readonly timeZone?: string;
	readonly launchNonce?: string;
}

/** A JSON field value, with undefined for a field the caller omitted. */
export type TrackerItemValue =
	| string
	| number
	| boolean
	| null
	| undefined
	| readonly TrackerItemValue[]
	| Readonly<{ [key: string]: TrackerItemValue }>;

export type TrackerItemInput = Readonly<Record<string, TrackerItemValue>>;
export type TrackerItemFields = Record<string, string | number | null>;
