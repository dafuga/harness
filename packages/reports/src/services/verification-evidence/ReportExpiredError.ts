// @harness-uid u_tagxmpm4v4
/** A report whose retention has expired, so its pending evidence cannot be stored. */
export class ReportExpiredError extends Error {
	override name = 'ReportExpiredError';
}
