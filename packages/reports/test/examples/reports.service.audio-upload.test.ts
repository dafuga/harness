import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { ReportRepository } from '../../src/repositories/reports-media/report-repository/ReportRepository';
import { AudioUploadService } from '../../src/services/reports-media/AudioUploadService';
import type {
	AudioComparisonInput,
	AudioUploadInput
} from '../../src/services/reports-media/AudioUploadService.types';
import { InvalidAudioFileSizeError } from '../../src/services/reports-media/InvalidAudioFileSizeError';
import { InvalidAudioTitleError } from '../../src/services/reports-media/InvalidAudioTitleError';

const REPORT_ID = '6b1f0e52-3c9a-4d7e-8f21-5a9c2e7b4d10';
const DETAILS = {
	title: 'Support call recording',
	note: 'Recorded on the support line.',
	source: 'Support line export'
};

// Minimal MPEG-1 Layer III bytes: an ID3v2 tag followed by one valid frame header.
function mp3Bytes(length = 440) {
	const bytes = Buffer.alloc(length);
	if (length === 0) return bytes;
	bytes.write('ID3', 0, 'ascii');
	bytes[3] = 4;
	bytes.set([0xff, 0xfb, 0x90, 0x00], 10);
	return bytes;
}

function mp3File(name: string, length?: number) {
	return new File([new Uint8Array(mp3Bytes(length))], name, { type: 'audio/mpeg' });
}

function summary(file: File) {
	return { name: file.name, bytes: file.size };
}

async function captureError(run: Promise<unknown>) {
	try {
		await run;
	} catch (caught) {
		return caught;
	}
	return undefined;
}

function errorOf(error: unknown) {
	return { name: (error as Error).name, message: (error as Error).message };
}

function meta(symbol: string, state: string) {
	return {
		unitId: 'reports.service.audio-upload',
		symbol,
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

test('Rejects an upload whose title is empty after trimming', async () => {
	const root = mkdtempSync(join(tmpdir(), 'audio-upload-title-'));
	try {
		const service = new AudioUploadService(new ReportRepository(root));
		const input: AudioUploadInput = { ...DETAILS, title: '   ', audio: mp3File('call.mp3') };
		const error = await captureError(service.upload(REPORT_ID, input));

		expect(error).toBeInstanceOf(InvalidAudioTitleError);
		expect((error as Error).message).toBe('Audio title must be 1–120 characters');
		recordExampleCases(
			meta('upload', 'rejects-an-upload-whose-title-is-empty-after-trimming'),
			[
				{
					name: 'whitespace-only title is rejected before the audio is read',
					input: { reportId: REPORT_ID, ...DETAILS, title: '   ', audio: summary(input.audio) },
					error: errorOf(error)
				}
			]
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('Rejects an upload whose audio file is empty', async () => {
	const root = mkdtempSync(join(tmpdir(), 'audio-upload-size-'));
	try {
		const service = new AudioUploadService(new ReportRepository(root));
		const input: AudioUploadInput = { ...DETAILS, audio: mp3File('call.mp3', 0) };
		const error = await captureError(service.upload(REPORT_ID, input));

		expect(error).toBeInstanceOf(InvalidAudioFileSizeError);
		expect((error as Error).message).toBe('Audio file must be 1 byte to 50 MB');
		recordExampleCases(
			meta('upload', 'rejects-an-upload-whose-audio-file-is-empty'),
			[
				{
					name: 'zero-byte mp3 is rejected by the 1 byte minimum',
					input: { reportId: REPORT_ID, ...DETAILS, audio: summary(input.audio) },
					error: errorOf(error)
				}
			]
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('Rejects a comparison whose report id is not a safe id', async () => {
	const root = mkdtempSync(join(tmpdir(), 'audio-upload-id-'));
	try {
		const service = new AudioUploadService(new ReportRepository(root));
		const input: AudioComparisonInput = {
			...DETAILS,
			before: mp3File('before.mp3'),
			after: mp3File('after.mp3')
		};
		const error = await captureError(service.uploadComparison('../escape', input));

		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toBe('Invalid report or asset ID');
		recordExampleCases(
			meta('uploadComparison', 'rejects-a-comparison-whose-report-id-is-not-a-safe-id'),
			[
				{
					name: 'path-like report id is rejected before any file is written',
					input: {
						reportId: '../escape',
						...DETAILS,
						before: summary(input.before),
						after: summary(input.after)
					},
					error: errorOf(error)
				}
			]
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
