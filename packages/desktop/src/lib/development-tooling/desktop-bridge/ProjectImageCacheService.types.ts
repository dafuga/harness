// @harness-uid u_tzt7ru2vow
export class UnknownProjectImageError extends Error {
	override name = 'UnknownProjectImageError';
}

export class ImageHashMismatchError extends Error {
	override name = 'ImageHashMismatchError';
}
