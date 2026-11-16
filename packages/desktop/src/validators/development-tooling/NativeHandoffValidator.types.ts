// @harness-uid u_u5rruiwyuu
export class ExpiredNativeHandoffError extends Error {
	override name = 'ExpiredNativeHandoffError';
}

export class InvalidNativeHandoffError extends Error {
	override name = 'InvalidNativeHandoffError';
}

export class InvalidNativeHandoffIdentityError extends Error {
	override name = 'InvalidNativeHandoffIdentityError';
}

export class InvalidNativeHandoffUrlError extends Error {
	override name = 'InvalidNativeHandoffUrlError';
}

export class NativeHandoffBindingMismatchError extends Error {
	override name = 'NativeHandoffBindingMismatchError';
}
