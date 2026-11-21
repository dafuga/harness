// @harness-uid u_vwqx4shw5t
/** A task worktree whose HEAD is not its submitted source, or whose repository is not the owner's. */
export class TaskWorktreeChangedError extends Error {
	override name = 'TaskWorktreeChangedError';
}
