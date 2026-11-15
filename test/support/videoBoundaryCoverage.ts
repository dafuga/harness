import { expect } from 'vitest';
import type { ScenarioManifest } from '../../src/core/development-tooling/unitTypes';
import type { Gathered } from '../../src/utils/verification-evidence/gatherCaptures';
import { scenarioCoverage } from '../../src/workflows/verification-evidence/run-verify/verification-service/scenarioCoverage';
import { videoLibraryFixture, video } from './videoCoverageFixture';

/** Boundary hashes are observed proof, rather than descriptive checkpoint names alone. */
export function assertVideoBoundaryCoverage(scenario: ScenarioManifest, item: Gathered) {
	const point = {
		viewport: 'desktop',
		entrySignature: '1'.repeat(64),
		exitSignature: '2'.repeat(64)
	};
	const signatures = { entrySignature: point.entrySignature, exitSignature: point.exitSignature };
	const declaration = videoLibraryFixture();
	const enrolled = {
		...scenario,
		video: {
			...declaration,
			clips: declaration.clips.map((clip) => ({ ...clip, checkpoints: [point] }))
		}
	};
	const judge = (changes: object) =>
		scenarioCoverage({
			scenario: enrolled,
			commit: 'a'.repeat(40),
			checkFailed: false,
			gathered: [{ ...item, line: { ...item.line, video: { ...video, ...changes } } } as Gathered],
			videoSlots: [
				{ unit: video.unit, clipId: video.clipId, viewport: 'desktop', inputHash: video.inputHash }
			],
			builds: { declared: ['reports'], compiled: new Map([['reports', 'build-1']]) }
		}).failures;
	expect(judge({}), 'unobserved checkpoint signatures must block video proof').not.toEqual([]);
	expect(judge(signatures)).toEqual([]);
	for (const changed of [{ entrySignature: '3'.repeat(64) }, { exitSignature: '4'.repeat(64) }])
		expect(
			judge({ ...signatures, ...changed }),
			'incompatible checkpoint signatures must block video proof'
		).not.toEqual([]);
}
