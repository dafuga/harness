// @harness-uid u_bl6xl2h4a3
export interface TrackerRecoveryState {
	token: string | null;
	requestedAt: number;
	lastToken?: string | null;
	retryAt: number;
	failures: string[];
}
