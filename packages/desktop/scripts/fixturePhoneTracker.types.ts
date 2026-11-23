// @harness-uid u_rp545ji5cr
export interface FixtureTrackerPorts {
	allowTracker(deviceId: string): void;
	tracker: { finish(): unknown };
}
