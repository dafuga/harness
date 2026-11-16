// @harness-uid u_rnymveoz42
export class InvalidRevisionError extends Error {
	override name = 'InvalidRevisionError';
}

export class UnsafeSourcePathError extends Error {
	override name = 'UnsafeSourcePathError';
}

export class SourceFileTooLargeError extends Error {
	override name = 'SourceFileTooLargeError';
}
