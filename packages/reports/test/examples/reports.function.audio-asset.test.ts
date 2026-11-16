import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { AudioContentMismatchError } from '../../src/utils/reports-media/audio-asset/AudioContentMismatchError';
import { InvalidAudioFileError } from '../../src/utils/reports-media/audio-asset/InvalidAudioFileError';
import { UnsupportedAudioFormatError } from '../../src/utils/reports-media/audio-asset/UnsupportedAudioFormatError';
import { audioAsset } from '../../src/utils/reports-media/audio-asset/audioAsset';
import { createHash } from 'node:crypto';

function wavFixture() {
	const bytes = Buffer.alloc(46);
	bytes.write('RIFF', 0);
	bytes.writeUInt32LE(38, 4);
	bytes.write('WAVEfmt ', 8);
	bytes.writeUInt32LE(16, 16);
	bytes.writeUInt16LE(1, 20);
	bytes.writeUInt16LE(1, 22);
	bytes.writeUInt32LE(8000, 24);
	bytes.writeUInt32LE(8000, 28);
	bytes.writeUInt16LE(1, 32);
	bytes.writeUInt16LE(8, 34);
	bytes.write('data', 36);
	bytes.writeUInt32LE(2, 40);
	bytes[44] = 128;
	bytes[45] = 129;
	return bytes;
}

test('Valid WAV receives a content hash and duration', () => {
	const bytes = wavFixture();
	const result = audioAsset(bytes, 'Site-Visit-2026-11-02.WAV');
	const output = { ...result };
	expect(output).toEqual({
		name: `${createHash('sha256').update(bytes).digest('hex')}.wav`,
		mimeType: 'audio/wav',
		mediaType: 'audio',
		durationSeconds: 2 / 8000
	});
	recordExampleCases(
		{
			unitId: 'reports.function.audio-asset',
			symbol: 'audioAsset',
			state: 'valid-wav-receives-a-content-hash-and-duration',
			evidence: 'examples-cases',
			file: 'valid-wav-receives-a-content-hash-and-duration.json'
		},
		[{ name: 'valid mono PCM WAV', input: { filename: 'Site-Visit-2026-11-02.WAV', byteLength: bytes.length }, output }]
	);
});

test('Invalid size is rejected before the filename', () => {
	let error: unknown;
	try {
		audioAsset(Buffer.alloc(0), 'voice.txt');
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(InvalidAudioFileError);
	const message = error instanceof Error ? error.message : String(error);
	recordExampleCases(
		{
			unitId: 'reports.function.audio-asset',
			symbol: 'audioAsset',
			state: 'invalid-size-is-rejected-before-the-filename',
			evidence: 'examples-cases',
			file: 'invalid-size-is-rejected-before-the-filename.json'
		},
		[{ name: 'empty content with unsupported extension', input: { filename: 'voice.txt', byteLength: 0 }, error: { name: 'InvalidAudioFileError', message } }]
	);
});

test('Unsupported formats and mismatched audio content are rejected', () => {
	let unsupported: unknown;
	try {
		audioAsset(Buffer.from('audio'), 'voice.txt');
	} catch (caught) {
		unsupported = caught;
	}
	let mismatch: unknown;
	try {
		audioAsset(Buffer.from('audio'), 'voicemail-0412.ogg');
	} catch (caught) {
		mismatch = caught;
	}
	expect(unsupported).toBeInstanceOf(UnsupportedAudioFormatError);
	expect(mismatch).toBeInstanceOf(AudioContentMismatchError);
	const errorSummary = (error: unknown) => ({
		name: error instanceof Error ? error.name : 'UnknownError',
		message: error instanceof Error ? error.message : String(error)
	});
	recordExampleCases(
		{
			unitId: 'reports.function.audio-asset',
			symbol: 'audioAsset',
			state: 'unsupported-formats-and-mismatched-audio-content-are-rejecte',
			evidence: 'examples-cases',
			file: 'unsupported-formats-and-mismatched-audio-content-are-rejecte.json'
		},
		[
			{ name: 'non-audio extension', input: { filename: 'voice.txt', byteLength: 5 }, error: errorSummary(unsupported) },
			{ name: 'invalid Ogg container', input: { filename: 'voicemail-0412.ogg', byteLength: 5 }, error: errorSummary(mismatch) }
		]
	);
});
