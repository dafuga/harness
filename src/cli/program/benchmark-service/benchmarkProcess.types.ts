export interface BenchmarkProcessInput {
	command: string[];
	cwd: string;
	input?: string;
	signal?: AbortSignal;
}

export interface BenchmarkProcessResult {
	exitCode: number;
	stdout: string;
	stderr: string;
}
