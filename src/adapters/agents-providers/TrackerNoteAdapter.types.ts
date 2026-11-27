// @harness-uid u_2d4uqig2pk
export interface TrackerNoteAdapterConfig {
	agent: string;
	/** Runs the tracker CLI with these arguments and returns stdout. */
	run: (args: readonly string[]) => Promise<string>;
}
