// @harness-uid u_segcni47nz
/** A report start or check time that is not a finite number of epoch milliseconds. */
export class InvalidReportRetentionTimestampError extends Error {
	override name = 'InvalidReportRetentionTimestampError';
}
