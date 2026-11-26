import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { captureVideo } from '../../src/utils/explorer-ui/harnessEvidence';
import type { HarnessCapture } from '../../src/models/explorer-ui/Harness.types';

const unitId = 'reports.function.harness-evidence';
export const commit = '9d2e4f1a7c3b8e05d6f1a2b3c4d5e6f708192a3b';
export const recordId = 'c41f0e9a7b2d5836f1e0a4c9b7d2e5f8a1c3b6d9e0f4a7b2c5d8e1f3a6b9c2d5';
const selectedRevision = '1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d';
export const shotSha = 'a3f1c9e07b52d84f6c1e9a0b3d5f7e21c4a8b6d09e2f5c7a1b3d4e6f8a0c2e4f';
export const pathBase = `evidence/${commit}/evidence-grid-review/evidence-grid-render`;
const server = {
	buildId: '4f0a9c2e7d1b8f36a5e0c9d4b7f2a1e8c6d3b0f9a4e7c2d5b8f1a6e3c0d9b7f4',
	revision: commit
};
const clipReference = {
	record: 'a'.repeat(64),
	revision: commit,
	unit: 'reports.component.evidence-grid',
	clipId: 'grid-walkthrough',
	viewport: 'desktop'
};
const originalRef = { ...clipReference, record: recordId };

/** Casts fixture literals to the stored shapes; only the fields the unit reads are provided. */
export function cast<T>(value: object): T {
	return value as T;
}

export function meta(symbol: string, state: string) {
	return { unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` };
}

function videoSummary(video: ReturnType<typeof captureVideo>) {
	return (
		video && {
			selectedRevision: video.selectedRevision,
			freshness: video.freshness,
			sha256: video.sha256,
			reference: video.reference
		}
	);
}

const videoCapture = cast<HarnessCapture>({
	evidence: 'grid-walkthrough-video',
	kind: 'video',
	state: 'populated',
	viewport: 'desktop',
	status: 'passed',
	path: `${pathBase}/grid-walkthrough.webm`,
	sha256: shotSha,
	mediaType: 'video/webm',
	capturedAt: '2026-11-10T14:40:00.000Z',
	media: `media/${shotSha}.webm`,
	video: { unit: 'reports.component.evidence-grid', clipId: 'grid-walkthrough', poster: {} },
	videoReference: { record: recordId, revision: commit }
});
const untaggedVideo = cast<HarnessCapture>({ ...videoCapture, videoReference: undefined });
const invalidVideo = cast<HarnessCapture>({
	...videoCapture,
	videoReference: { record: 'not-a-record', revision: commit }
});
export const desktopShot = cast<HarnessCapture>({
	evidence: 'evidence-grid-review-screens',
	kind: 'screenshot',
	state: 'populated',
	viewport: 'desktop',
	status: 'passed',
	path: `${pathBase}/evidence-grid-review-desktop.png`,
	sha256: shotSha,
	mediaType: 'image/png',
	capturedAt: '2026-11-10T14:32:08.114Z',
	provenance: 'actual-capture',
	server,
	media: `media/${shotSha}.png`
});

test('Projects a stored video clip with its original reference', () => {
	const projected = captureVideo(videoCapture, clipReference, selectedRevision, 'current');
	const untagged = captureVideo(untaggedVideo, clipReference, selectedRevision, 'stale');
	const invalid = captureVideo(invalidVideo, clipReference, selectedRevision, 'current');
	expect(videoSummary(projected)).toEqual({
		selectedRevision,
		freshness: 'current',
		sha256: shotSha,
		reference: originalRef
	});
	expect(videoSummary(untagged)).toEqual({
		selectedRevision,
		freshness: 'stale',
		sha256: shotSha,
		reference: clipReference
	});
	expect(videoSummary(invalid)).toEqual({
		selectedRevision,
		freshness: 'current',
		sha256: shotSha
	});
	expect(captureVideo(desktopShot, clipReference, selectedRevision, 'current')).toBeUndefined();
	recordExampleCases(
		meta('captureVideo', 'projects-a-stored-video-clip-with-its-original-reference'),
		[
			{
				name: 'video clip keeps its original parent record and revision',
				input: { capture: videoCapture, reference: clipReference, freshness: 'current' },
				output: videoSummary(projected)
			},
			{
				name: 'clip without lineage keeps the scenario address',
				input: { capture: untaggedVideo, reference: clipReference, freshness: 'stale' },
				output: videoSummary(untagged)
			},
			{
				name: 'invalid parent record omits the flagging reference',
				input: { capture: invalidVideo, reference: clipReference, freshness: 'current' },
				output: videoSummary(invalid)
			}
		]
	);
});
