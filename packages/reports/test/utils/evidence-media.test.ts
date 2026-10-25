import { expect, test } from 'vitest';
import manifest from '../../../../test/fixtures/contract-migration/evidence-examples.json';
import { TestExpectationService } from '../../../../src/services/verification-evidence/TestExpectationService';
import type { ComponentManifest } from '../../../../src/core/unitTypes';
import * as media from '../../src/utils/evidenceMedia';
import { reportFilter } from '../../src/components/evidence-grid/reportFilter';

const functions = {
	// JSON cannot carry NaN or Infinity, so authored examples store them as `{ nonFinite }`.
	formatDuration: (seconds: number | { nonFinite: string } | undefined) => {
		expect(media, 'duration formatting is named for its operation').toHaveProperty(
			'formatDuration',
			expect.any(Function)
		);
		expect(media).not.toHaveProperty('audioDuration');
		return media.formatDuration(typeof seconds === 'object' ? Number(seconds.nonFinite) : seconds);
	},
	mediaMime: media.mediaMime,
	evidenceMedia: media.evidenceMedia
};

new TestExpectationService().registerExamples(test, manifest as ComponentManifest, functions);

// Owned by reports.function.report-filter; kept here until primary transfers it.
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
