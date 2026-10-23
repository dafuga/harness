export interface BenchOptions {
	root?: string;
	quick?: boolean;
	/** `true` writes the profile file in the repository; a string writes that file. */
	write?: boolean | string;
	cli: string[];
}
