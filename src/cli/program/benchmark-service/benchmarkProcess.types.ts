// @harness-uid u_i5lew455cw
export interface BenchmarkProcessInput {
	command: string[];
	cwd: string;
	input?: string;
	signal?: AbortSignal;
	timeoutMs?: number;
}

export interface BenchmarkProcessResult {
	exitCode: number;
	stdout: string;
	stderr: string;
}
