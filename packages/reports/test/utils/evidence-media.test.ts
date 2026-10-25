import { expect, test } from 'vitest';
import * as media from '../../src/utils/evidenceMedia';
const { evidenceMedia, mediaMime } = media;
test('legacy image manifests and portable audio keep their media kind', () => {
	expect(evidenceMedia({ file: 'hash.png' })).toBe('image');
	expect(evidenceMedia({ file: 'hash.wav' })).toBe('audio');
	expect(evidenceMedia({ file: 'data:audio/wav;base64,AAA' })).toBe('audio');
	expect(mediaMime('hash.m4a')).toBe('audio/mp4');
	expect(media, 'duration formatting is named for its operation').toHaveProperty(
		'formatDuration',
		expect.any(Function)
	);
	expect(media).not.toHaveProperty('audioDuration');
	for (const [seconds, output] of [
		[undefined, ''],
		[NaN, ''],
		[Infinity, ''],
		[-1, ''],
		[0, '0:00'],
		[19.6, '0:19'],
		[90, '1:30'],
		[3661, '1:01:01']
	] as const)
		expect(media.formatDuration(seconds)).toBe(output);
});
