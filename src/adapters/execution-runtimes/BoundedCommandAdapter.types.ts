import type { ChildProcess } from 'node:child_process';
export interface BoundedCommandOptions {
	cwd?: string;
	env?: Record<string, string | undefined>;
	input?: string | Buffer;
	timeoutMs?: number;
	maxBuffer?: number;
	signal?: AbortSignal;
	onSpawn?: (child: ChildProcess) => void;
}
export interface BoundedCommandResult {
	code: number;
	stdout: Buffer;
	stderr: string;
}
