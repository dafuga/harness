// @harness-uid u_kg5hqf7tuv
export interface HealthProbeResult {
	name: string;
	url: string;
	status: number | 'unreachable';
	latencyMs: number;
}
