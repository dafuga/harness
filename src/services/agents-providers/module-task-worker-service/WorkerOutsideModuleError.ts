// @harness-uid u_b4uzqkb2i6
/** A worker's changes reached a path outside its module's files, so the worktree is preserved for review. */
export class WorkerOutsideModuleError extends Error {
	override name = 'WorkerOutsideModuleError';
}
