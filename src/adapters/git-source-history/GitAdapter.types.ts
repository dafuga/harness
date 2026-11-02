// @harness-uid u_pghy4246hw
export interface GitRunOptions {
	input?: string | Buffer;
	env?: Record<string, string>;
}

export interface GitResult {
	code: number;
	stdout: Buffer;
	stderr: string;
}
