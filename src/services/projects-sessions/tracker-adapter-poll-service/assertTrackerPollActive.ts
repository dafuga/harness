// @harness-uid u_wlip653voz
export function assertTrackerPollActive(signal: AbortSignal): void {
	if (signal.aborted) throw new Error('Tracker adapter poll cancelled');
}
