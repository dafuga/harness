// @harness-uid u_2evzki4xia
/** An artifact whose media type is missing or not a string, so this app cannot read it. */
export class InvalidMediaTypeError extends Error {
	override name = 'InvalidMediaTypeError';
}
