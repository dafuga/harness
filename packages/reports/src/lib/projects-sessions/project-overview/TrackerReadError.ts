// @harness-uid u_5dffuccadc
/** A loopback Tracker read that failed, ran out of time or returned an unusable status. */
export class TrackerReadError extends Error {
	override name = 'TrackerReadError';
}
