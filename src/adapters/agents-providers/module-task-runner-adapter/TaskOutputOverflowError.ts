// @harness-uid u_rw64iex44n
/** Task CLI output grew past its bound, so the process is killed and the run rejected. */
export class TaskOutputOverflowError extends Error {
	override name = 'TaskOutputOverflowError';
}
