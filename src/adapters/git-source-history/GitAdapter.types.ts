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

export { GitCommandError } from './GitCommandError';
