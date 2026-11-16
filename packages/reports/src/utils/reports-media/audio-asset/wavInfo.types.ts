// @harness-uid u_gdnv3z63vh
/** A WAV file that wavInfo rejects as malformed or in an unsupported audio format. */
export class InvalidWavError extends Error {
	override name = 'InvalidWavError';
}
