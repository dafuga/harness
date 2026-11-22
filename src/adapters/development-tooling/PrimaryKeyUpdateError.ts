// @harness-uid u_3fffcewbke
/** An update whose input sets the configured primary key, which cannot be updated. */
export class PrimaryKeyUpdateError extends Error {
	override name = 'PrimaryKeyUpdateError';
}
