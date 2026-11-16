// @harness-uid u_6yzc5wxfxm
export class PreviewOwnerPortOccupiedError extends Error {
	override name = 'PreviewOwnerPortOccupiedError';
}

export class InvalidPreviewOwnerAddressError extends Error {
	override name = 'InvalidPreviewOwnerAddressError';
}

export class PreviewOwnerIdentityMismatchError extends Error {
	override name = 'PreviewOwnerIdentityMismatchError';
}

export class PreviewOwnerStillStartingError extends Error {
	override name = 'PreviewOwnerStillStartingError';
}
