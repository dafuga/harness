// @harness-uid u_tbd5q8syce
/** An install step that cannot continue and leaves the previous service in place. */
export class TrackerBundleError extends Error {
	override name = 'TrackerBundleError';
}
