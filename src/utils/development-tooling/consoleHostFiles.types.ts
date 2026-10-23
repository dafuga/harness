export interface HostFile {
	/** Path inside the host project. */
	path: string;
	contents: string;
}

export interface ConsoleHostOptions {
	/** Route the console is served under, for example `/harness`. */
	base: string;
	/** Module of the host that exports its admin policy, for example `$lib/server/harnessPolicy`. */
	policyModule: string;
	policyExport: string;
	/** A private object store binding the history is read from, instead of the server bundle. */
	bucket?: { binding: string; prefix: string };
}
