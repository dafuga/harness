// @harness-uid u_mdrydzunlb

/** The fields of an item, from any surface, that decide what its flag is. */
export interface TrackerAskState {
	title?: string | null;
	needs_daniel?: boolean | number | null;
	resolved?: boolean | number | null;
	status?: string | null;
	question?: string | null;
	options?: string | readonly { label?: string; recommended?: boolean }[] | null;
}
