// @harness-uid u_2kqdk2v3f6
export class InvalidAudioFileError extends Error {
	override name = 'InvalidAudioFileError';
}

export class UnsupportedAudioFormatError extends Error {
	override name = 'UnsupportedAudioFormatError';
}

export class AudioContentMismatchError extends Error {
	override name = 'AudioContentMismatchError';
}
