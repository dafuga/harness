import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { formatDuration } from '../../src/helpers/strings/formatDuration';
import { mediaMime, evidenceMedia } from '../../src/utils/verification-evidence/evidenceMedia';

const unitId = 'reports.function.evidence-media';
const pngFile = '3f9c1e7a5b2d8064c1a9f3e7d2b5a80f6e4c1d9b7a2f3e8c5d0b1a4f7e6c9d23.png';
const oggFile = 'a61d0f9e3c7b2a85d4e1f6c09b3a7d52e8f1c4b6a9d0e3f7c2b5a8d1e4f6c930.ogg';
const mp3File = '0c4e8b1d7f3a9e52b6d0c8f1a4e7b3d9c2f6a0e5b8d1c4f7a3e9b2d6c0f5a817.mp3';
const m4aFile = 'Checkout-Walkthrough.M4A';
const pdfFile = 'client-brief-2.pdf';

function caseMeta(symbol: string, state: string) {
	return { unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` };
}

test('Formats durations as minutes and hours', () => {
	const outputs = [
		formatDuration(4.52),
		formatDuration(93.8),
		formatDuration(3725.4),
		formatDuration(-1),
		formatDuration(Number.NaN),
		formatDuration()
	];
	expect(outputs).toEqual(['0:04', '1:33', '1:02:05', '', '', '']);
	recordExampleCases(caseMeta('formatDuration', 'formats-durations-as-minutes-and-hours'), [
		{ name: 'clip of 4.52 seconds floors to 0:04', input: 4.52, output: outputs[0] },
		{ name: 'clip of 93.8 seconds shows 1:33', input: 93.8, output: outputs[1] },
		{ name: 'clip of 3725.4 seconds shows hours form', input: 3725.4, output: outputs[2] },
		{ name: 'negative duration gives empty string', input: -1, output: outputs[3] },
		{ name: 'NaN duration gives empty string', input: 'NaN', output: outputs[4] },
		{ name: 'omitted duration gives empty string', input: null, output: outputs[5] }
	]);
});

test('Maps evidence file names to MIME types', () => {
	const outputs = [
		mediaMime(mp3File),
		mediaMime(m4aFile),
		mediaMime(pngFile),
		mediaMime('report.xyz')
	];
	expect(outputs).toEqual(['audio/mpeg', 'audio/mp4', 'image/png', 'application/octet-stream']);
	expect(() => mediaMime(null as unknown as string)).toThrow(TypeError);
	recordExampleCases(caseMeta('mediaMime', 'maps-evidence-file-names-to-mime-types'), [
		{ name: 'mp3 asset name maps to audio/mpeg', input: mp3File, output: outputs[0] },
		{
			name: 'upper-case M4A extension is matched case-insensitively',
			input: m4aFile,
			output: outputs[1]
		},
		{ name: 'png asset name maps to image/png', input: pngFile, output: outputs[2] },
		{ name: 'unknown extension maps to octet-stream', input: 'report.xyz', output: outputs[3] },
		{ name: 'null file name throws TypeError', input: null, error: 'TypeError' }
	]);
});

test('Classifies evidence items as audio or image', () => {
	const outputs = [
		evidenceMedia({ file: pngFile }),
		evidenceMedia({ mediaType: 'audio', file: oggFile }),
		evidenceMedia({ file: 'data:audio/mpeg;base64,AAAA' }),
		evidenceMedia({ file: pdfFile })
	];
	expect(outputs).toEqual(['image', 'audio', 'audio', 'image']);
	expect(() => evidenceMedia(null as unknown as Parameters<typeof evidenceMedia>[0])).toThrow(
		TypeError
	);
	recordExampleCases(caseMeta('evidenceMedia', 'classifies-evidence-items-as-audio-or-image'), [
		{ name: 'png file without mediaType is image', input: { file: pngFile }, output: outputs[0] },
		{
			name: 'explicit audio mediaType is returned as set',
			input: { mediaType: 'audio', file: oggFile },
			output: outputs[1]
		},
		{
			name: 'data audio address without mediaType is audio',
			input: { file: 'data:audio/mpeg;base64,AAAA' },
			output: outputs[2]
		},
		{ name: 'pdf file without mediaType is image', input: { file: pdfFile }, output: outputs[3] }
	]);
});

test('Throws TypeError when mediaMime receives a null file', () => {
	expect(() => mediaMime(null as unknown as string)).toThrow(TypeError);
	recordExampleCases(
		caseMeta('mediaMime', 'throws-typeerror-when-mediamime-receives-a-null-file'),
		[{ name: 'null file name throws TypeError', input: null, error: 'TypeError' }]
	);
});

test('Throws TypeError when evidenceMedia receives a null item', () => {
	const item = null as unknown as Parameters<typeof evidenceMedia>[0];
	expect(() => evidenceMedia(item)).toThrow(TypeError);
	recordExampleCases(
		caseMeta('evidenceMedia', 'throws-typeerror-when-evidencemedia-receives-a-null-item'),
		[{ name: 'null evidence item throws TypeError', input: null, error: 'TypeError' }]
	);
});

test('Throws TypeError when evidenceMedia gets a non-string file', () => {
	const item = { file: 42 as unknown as string };
	expect(() => evidenceMedia(item)).toThrow(TypeError);
	recordExampleCases(
		caseMeta('evidenceMedia', 'throws-typeerror-when-evidencemedia-gets-a-non-string-file'),
		[{ name: 'numeric file without mediaType throws TypeError', input: item, error: 'TypeError' }]
	);
});
