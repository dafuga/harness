// @harness-uid u_e7x5dhawh4
/** The notification queue cannot safely acquire a worker or use its persisted state. */
export class TrackerNotificationQueueError extends Error {
	override readonly name = 'TrackerNotificationQueueError';
}
