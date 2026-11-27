import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { wavInfo } from '../../src/utils/reports-media/audio-asset/wavInfo';
import { InvalidWavError } from '../../src/utils/reports-media/audio-asset/wavInfo.types';
import type { FormatOptions } from './reports.function.wav-info.test.types';

const pcm16Mono: FormatOptions = { encoding: 1, channels: 1, sampleRate: 8000, bits: 16 };

function formatChunk({ encoding, channels, sampleRate, bits }: FormatOptions): Buffer {
	const align = (channels * bits) / 8;
	const format = Buffer.alloc(16);
	format.writeUInt16LE(encoding, 0);
	format.writeUInt16LE(channels, 2);
	format.writeUInt32LE(sampleRate, 4);
	format.writeUInt32LE(sampleRate * align, 8);
	format.writeUInt16LE(align, 12);
	format.writeUInt16LE(bits, 14);
	return format;
}

function chunk(name: string, body: Buffer): Buffer {
	const header = Buffer.alloc(8);
	header.write(name, 0, 'ascii');
	header.writeUInt32LE(body.length, 4);
	const pad = body.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0);
	return Buffer.concat([header, body, pad]);
}

function buildWav(format: FormatOptions, data: Buffer): Buffer {
	const body = Buffer.concat([
		Buffer.from('WAVE', 'ascii'),
		chunk('fmt ', formatChunk(format)),
		chunk('data', data)
	]);
	const riff = Buffer.concat([Buffer.from('RIFF', 'ascii'), Buffer.alloc(4), body]);
	riff.writeUInt32LE(riff.length - 8, 4);
	return riff;
}

function rejection(bytes: Buffer): { name: string; message: string } {
	let error: unknown;
	try {
		wavInfo(bytes);
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(InvalidWavError);
	const actual = error as InvalidWavError;
	return { name: actual.name, message: actual.message };
}

test('Reports duration for accepted PCM and float WAV files', () => {
	const samples: Array<{ name: string; format: FormatOptions; dataBytes: number }> = [
		{ name: 'pcm 16-bit mono 8000 Hz, one second', format: pcm16Mono, dataBytes: 16000 },
		{
			name: 'pcm 8-bit mono 8000 Hz, half a second',
			format: { encoding: 1, channels: 1, sampleRate: 8000, bits: 8 },
			dataBytes: 4000
		},
		{
			name: 'float 32-bit stereo 48000 Hz, two and a half seconds',
			format: { encoding: 3, channels: 2, sampleRate: 48000, bits: 32 },
			dataBytes: 960000
		}
	];
	const cases = samples.map(({ name, format, dataBytes }) => {
		const bytes = buildWav(format, Buffer.alloc(dataBytes));
		const output = wavInfo(bytes);
		return {
			name,
			input: { ...format, dataBytes, fileBytes: bytes.length },
			output
		};
	});

	expect(cases.map((item) => item.output)).toEqual([
		{ durationSeconds: 1 },
		{ durationSeconds: 0.5 },
		{ durationSeconds: 2.5 }
	]);

	recordExampleCases(
		{
			unitId: 'reports.function.wav-info',
			symbol: 'wavInfo',
			state: 'reports-duration-for-accepted-pcm-and-float-wav-files',
			evidence: 'examples-cases',
			file: 'reports-duration-for-accepted-pcm-and-float-wav-files.json'
		},
		cases
	);
});

test('Rejects malformed or unsupported WAV bytes', () => {
	const valid = buildWav(pcm16Mono, Buffer.alloc(16000));
	const tooShort = Buffer.from('RIFF', 'ascii');
	const badSize = Buffer.from(valid);
	badSize.writeUInt32LE(valid.length - 7, 4);
	const truncated = Buffer.from(valid);
	truncated.writeUInt32LE(20000, 40);
	const floatSixteenBit = buildWav(
		{ encoding: 3, channels: 1, sampleRate: 8000, bits: 16 },
		Buffer.alloc(16000)
	);
	const oddData = buildWav(pcm16Mono, Buffer.alloc(3));

	const inputs = [
		{ name: 'fewer than 44 bytes', bytes: tooShort, summary: { fileBytes: tooShort.length } },
		{ name: 'RIFF size field off by one', bytes: badSize, summary: { fileBytes: badSize.length } },
		{
			name: 'data chunk longer than container',
			bytes: truncated,
			summary: { fileBytes: truncated.length }
		},
		{
			name: 'IEEE float with 16-bit samples',
			bytes: floatSixteenBit,
			summary: { fileBytes: floatSixteenBit.length }
		},
		{
			name: 'data length not a multiple of block align',
			bytes: oddData,
			summary: { fileBytes: oddData.length }
		}
	];
	const cases = inputs.map(({ name, bytes, summary }) => ({
		name,
		input: summary,
		error: rejection(bytes)
	}));

	expect(cases.map((item) => item.error.message)).toEqual([
		'Invalid WAV audio',
		'Invalid WAV container length',
		'Truncated WAV chunk',
		'Unsupported WAV audio format',
		'Invalid WAV audio data length'
	]);

	recordExampleCases(
		{
			unitId: 'reports.function.wav-info',
			symbol: 'wavInfo',
			state: 'rejects-malformed-or-unsupported-wav-bytes',
			evidence: 'examples-cases',
			file: 'rejects-malformed-or-unsupported-wav-bytes.json'
		},
		cases
	);
});
