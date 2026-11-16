// @harness-uid u_nldvaltl5k
/** A patch destination equal to its source, so patch refuses before any archive work begins. */
export class ArchiveDestinationNotSeparateError extends Error {
	override name = 'ArchiveDestinationNotSeparateError';
}
