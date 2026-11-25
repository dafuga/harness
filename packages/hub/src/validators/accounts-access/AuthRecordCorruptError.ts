// @harness-uid u_5fft2ktu72
/** A stored hub auth record that is not an object, or has a field that is missing, mistyped, or outside its allowed values. */
export class AuthRecordCorruptError extends Error {
	override name = 'AuthRecordCorruptError';
}
