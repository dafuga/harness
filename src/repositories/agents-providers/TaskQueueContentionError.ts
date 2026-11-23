// @harness-uid u_bya7wvvkm5
/** The task ref kept moving under concurrent writers, so the update gave up after 16 attempts. */
export class TaskQueueContentionError extends Error {
	override name = 'TaskQueueContentionError';
}
