// @harness-uid u_wlip653voz
export class TrackerAdapterPollError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'TrackerAdapterPollError';
	}
}

export function assertTrackerPollActive(signal: AbortSignal): void {
	if (signal.aborted) throw new TrackerAdapterPollError('Tracker adapter poll cancelled');
}
