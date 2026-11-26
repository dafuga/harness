// @harness-uid u_gvqtr5mdwv
export class TrackerNodeTransportError extends Error {
	/** `status` is the HTTP status of a failed response, when one arrived. */
	constructor(
		message: string,
		readonly status?: number
	) {
		super(message);
	}
}
