// @harness-uid u_pghy4246hw
/** A Git command that exited non-zero; the message gives its arguments and trimmed stderr. */
export class GitCommandError extends Error {
	override name = 'GitCommandError';
}
