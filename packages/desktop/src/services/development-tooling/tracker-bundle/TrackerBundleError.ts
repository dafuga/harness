// @harness-uid u_xrklrpg3zi
// @harness-uid u_tbd5q8syce
/** An install step that cannot continue and leaves the previous service in place. */
export class TrackerBundleError extends Error {
	override name = 'TrackerBundleError';

	/** Limit persisted diagnostics to installer messages and runtime error identifiers. */
	static describe(error: unknown): string {
		if (error instanceof TrackerBundleError) return error.message;
		if (!(error instanceof Error)) return 'Unknown install error';
		const { code } = error as NodeJS.ErrnoException;
		return code ? `${error.name} (${code})` : error.name;
	}
}
