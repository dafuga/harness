// @harness-uid u_jkomno4o5u
/** A client failure whose fixed message can be included in the HTTP response. */
export class TrackerHubInputError extends Error {
	constructor(
		readonly status: 400 | 413,
		message: string
	) {
		super(message);
	}
}
