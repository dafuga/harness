export interface BuildOptions {
	root?: string;
	/** Output directory for the index, the revision details and the media. */
	out?: string;
	/** Newest commits to include; older ones are left out and the index says so. */
	limit?: string;
}
