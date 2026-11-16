// @harness-uid u_pghy4246hw
export interface GitRunOptions {
	input?: string | Buffer;
	env?: Record<string, string>;
	timeoutMs?: number;
	maxBuffer?: number;
}

export interface GitResult {
	code: number;
	stdout: Buffer;
	stderr: string;
}

/** A Git command that exited non-zero; the message gives its arguments and trimmed stderr. */
export class GitCommandError extends Error {
	override name = 'GitCommandError';
}
