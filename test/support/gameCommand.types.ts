export interface Scope {
	units: string[];
	workload: string;
	cli?: string;
	expectedExitCode?: number;
}

export interface Observed {
	elapsedMs: number;
	peakRssBytes: number;
	stdout: string;
	stderr: string;
	exitCode: number;
}

/** What the driver prints: Bun's raw `maxRSS` and the platform whose accounting produced it. */
export interface Reported {
	elapsedMs: number;
	maxRSS: number;
	platform: string;
	stdout: string;
	stderr: string;
	exitCode: number;
}
