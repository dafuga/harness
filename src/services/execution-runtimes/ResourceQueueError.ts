// @harness-uid u_wugtubbkbv
/**
 * A resource request the queue refuses: a bad wait timeout, an unusable owner, a full queue,
 * or an invalid or over-budget inherited lease.
 */
export class ResourceQueueError extends Error {
	override name = 'ResourceQueueError';
}
