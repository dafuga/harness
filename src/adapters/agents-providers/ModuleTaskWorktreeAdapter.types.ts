// @harness-uid u_vwqx4shw5t
export interface TaskCheckpointInput {
	cwd: string;
	source: string;
	paths: string[];
}
/** A task worktree whose HEAD is not its submitted source, or whose repository is not the owner's. */
export class TaskWorktreeChangedError extends Error {
	override name = 'TaskWorktreeChangedError';
}
