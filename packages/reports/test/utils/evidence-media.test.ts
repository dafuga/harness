import { expect, test } from 'vitest';
import { evidenceMedia, mediaMime, audioDuration } from '../../src/utils/evidenceMedia';
import { reportFilter } from '../../src/utils/reportFilter';
test('legacy image manifests and portable audio keep their media kind', () => {
	expect(evidenceMedia({ file: 'hash.png' })).toBe('image');
	expect(evidenceMedia({ file: 'hash.wav' })).toBe('audio');
	expect(evidenceMedia({ file: 'data:audio/wav;base64,AAA' })).toBe('audio');
	expect(mediaMime('hash.m4a')).toBe('audio/mp4');
	expect(audioDuration(19.6)).toBe('0:19');
	expect(audioDuration(3661)).toBe('1:01:01');
});
test('search finds audio transcript and source', () => {
	const item = {
		id: 'voice',
		title: 'Sound',
		category: 'Audio',
		file: 'hash.wav',
		status: 'failed' as const,
		transcript: 'Quiet time',
		source: 'French GPT Live'
	};
	for (const search of ['quiet', 'French'])
		expect(reportFilter([item], { search, category: '', phase: '', status: '' })).toEqual([item]);
});
