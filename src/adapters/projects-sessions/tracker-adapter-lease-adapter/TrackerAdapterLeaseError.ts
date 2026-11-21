// @harness-uid u_7xh35kvg5l
export class TrackerAdapterLeaseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'TrackerAdapterLeaseError';
	}
}
