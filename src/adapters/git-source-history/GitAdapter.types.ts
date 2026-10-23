export interface GitRunOptions {
	input?: string | Buffer;
	env?: Record<string, string>;
}

export interface GitResult {
	code: number;
	stdout: Buffer;
	stderr: string;
}
