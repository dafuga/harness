import { expect, test } from 'vitest';
import manifest from '../../../../specification/units/reports.function.evidence-media.json';
import { TestExpectationService } from '../../../../src/services/verification-evidence/TestExpectationService';
import type { ComponentManifest } from '../../../../src/core/unitTypes';
import * as media from '../../src/utils/evidenceMedia';

const functions = {
	// JSON cannot carry NaN or Infinity, so authored examples store them as `{ nonFinite }`.
	formatDuration: (seconds: number | { nonFinite: string } | null | undefined) => {
		expect(media, 'duration formatting is named for its operation').toHaveProperty(
			'formatDuration',
			expect.any(Function)
		);
		expect(media).not.toHaveProperty('audioDuration');
		return media.formatDuration(
			typeof seconds === 'object' && seconds !== null
				? Number(seconds.nonFinite)
				: (seconds as number | undefined)
		);
	},
	mediaMime: media.mediaMime,
	evidenceMedia: media.evidenceMedia
};

new TestExpectationService().registerExamples(test, manifest as ComponentManifest, functions);
