// @harness-uid u_6nfsvjbuup
export interface TrackerOverloadState {
	over_since: number | null;
	calm_since: number | null;
	/** The Chief of Staff item raised for the current overload. */
	flagged_item: string | null;
}
