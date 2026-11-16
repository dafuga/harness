// @harness-uid u_3cc7k2w5o3
export class InvalidAudioTitleError extends Error {
	override name = 'InvalidAudioTitleError';
}

export class AudioDetailsTooLargeError extends Error {
	override name = 'AudioDetailsTooLargeError';
}

export class InvalidAudioFileSizeError extends Error {
	override name = 'InvalidAudioFileSizeError';
}

export interface AudioDetails {
	title: string;
	note: string;
	source: string;
}

export interface AudioUploadInput extends AudioDetails {
	audio: File;
}

export interface AudioComparisonInput extends AudioDetails {
	before: File;
	after: File;
}
