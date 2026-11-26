// @harness-uid u_khpp77xvn3
/** A hosted image that is not a string, exceeds its byte cap, or fails its SHA-256 check. */
export class InvalidHostedImageError extends Error {
	override name = 'InvalidHostedImageError';
}
