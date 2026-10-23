export interface GroupTiming {
	/** How long what a command started may take to end by itself once the command has ended. */
	settleMs: number;
	graceMs: number;
}
