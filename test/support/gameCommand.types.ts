export interface Scope {
	units: string[];
	workload: string;
	cli?: string;
}

export interface Observed {
	elapsedMs: number;
	peakRssBytes: number;
	stdout: string;
}

/** What the driver prints: Bun's raw `maxRSS` and the platform whose accounting produced it. */
export interface Reported {
	elapsedMs: number;
	maxRSS: number;
	platform: string;
	stdout: string;
}
