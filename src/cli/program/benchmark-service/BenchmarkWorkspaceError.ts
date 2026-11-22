// @harness-uid u_gstm2koub7
/** A benchmark Git, tree, or snapshot operation failed; its message names the cause. */
export class BenchmarkWorkspaceError extends Error {
	override name = 'BenchmarkWorkspaceError';
}
