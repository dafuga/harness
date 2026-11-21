// @harness-uid u_vqnqshfas2
/** A persisted delivery reference or journal position cannot be advanced. */
export class TrackerNotificationStateError extends Error {
	override readonly name = 'TrackerNotificationStateError';
}
