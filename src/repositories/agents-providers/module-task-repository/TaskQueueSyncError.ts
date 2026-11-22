// @harness-uid u_bya7wvvkm5
/** The explicit task ref could not be exchanged: its remote name is unusable or its histories diverged. */
export class TaskQueueSyncError extends Error {
	override name = 'TaskQueueSyncError';
}
