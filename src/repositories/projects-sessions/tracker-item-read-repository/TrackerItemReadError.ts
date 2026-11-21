// @harness-uid u_xba7ieg4je
/** Public diagnostic and the status the loopback handler should return. */
export class TrackerItemReadError extends Error {
	constructor(
		message: string,
		readonly status: number = 400
	) {
		super(message);
		this.name = 'TrackerItemReadError';
	}
}
