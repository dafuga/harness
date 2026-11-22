// @harness-uid u_bya7wvvkm5
/** The local task-owner identity is not a UUID, or this process's start time cannot be established. */
export class TaskOwnerIdentityError extends Error {
	override name = 'TaskOwnerIdentityError';
}
