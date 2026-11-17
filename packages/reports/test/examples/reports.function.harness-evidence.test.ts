import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { captureVideo, mediaFile, harnessEvidence } from '../../src/utils/explorer-ui/harnessEvidence';
import type { HarnessCapture, HarnessRecord } from '../../src/models/explorer-ui/Harness.types';
import type { HarnessRevision } from '../../src/models/explorer-ui/HarnessRevision.types';

const unitId = 'reports.function.harness-evidence';
const commit = '9d2e4f1a7c3b8e05d6f1a2b3c4d5e6f708192a3b';
const recordId = 'c41f0e9a7b2d5836f1e0a4c9b7d2e5f8a1c3b6d9e0f4a7b2c5d8e1f3a6b9c2d5';
const selectedRevision = '1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d';
const shotSha = 'a3f1c9e07b52d84f6c1e9a0b3d5f7e21c4a8b6d09e2f5c7a1b3d4e6f8a0c2e4f';
const mobileSha = '5d0e8b3af61c9274b0d5e8a17c3f6920e4b1d7a508f3c6e29b4a1d70c6e5f283';
const audioSha = '2e9b47c1a86d0f35d1c7e4b9f0a2836d5c4e1b7a93d8f6e0b2a5c18f4d7e0a39';
const pathBase = `evidence/${commit}/evidence-grid-review/evidence-grid-render`;
const server = { buildId: '4f0a9c2e7d1b8f36a5e0c9d4b7f2a1e8c6d3b0f9a4e7c2d5b8f1a6e3c0d9b7f4', revision: commit };

const clipReference = {
	record: 'a'.repeat(64),
	revision: commit,
	unit: 'reports.component.evidence-grid',
	clipId: 'grid-walkthrough',
	viewport: 'desktop'
};
const originalRef = { ...clipReference, record: recordId };

/** Casts fixture literals to the stored shapes; only the fields the unit reads are provided. */
function cast<T>(value: object): T {
	return value as T;
}

function meta(symbol: string, state: string) {
	return { unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` };
}

function videoSummary(video: ReturnType<typeof captureVideo>) {
	return video && { selectedRevision: video.selectedRevision, freshness: video.freshness, sha256: video.sha256, reference: video.reference };
}

function gallerySummary(items: ReturnType<typeof harnessEvidence>) {
	return items.map((item) => ({ id: item.id, file: item.file, status: item.status, viewport: item.viewport, missing: item.missing, mediaType: item.mediaType }));
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
const desktopShot = cast<HarnessCapture>({
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
const mobileShot = cast<HarnessCapture>({
	...desktopShot,
	viewport: 'mobile',
	path: `${pathBase}/evidence-grid-review-mobile.png`,
	sha256: mobileSha,
	capturedAt: '2026-11-10T14:33:02.557Z',
	media: null,
	gap: 'the mobile file is not part of this record'
});
const audioCapture = cast<HarnessCapture>({
	evidence: 'evidence-grid-review-walkthrough',
	kind: 'audio',
	state: 'populated',
	status: 'passed',
	path: `${pathBase}/evidence-grid-walkthrough.wav`,
	sha256: audioSha,
	mediaType: 'audio/wav',
	capturedAt: '2026-11-10T14:35:41.902Z',
	durationSeconds: 42.5,
	transcript: 'Opened the evidence grid and confirmed captured rows are visible.',
	media: `media/${audioSha}.wav`
});

function recordWith(states: object[]): HarnessRecord {
	return cast<HarnessRecord>({
		id: recordId,
		status: 'passed',
		valid: true,
		problems: [],
		source: { commit, base: null },
		profile: '5e0b7c1d9a4f2836',
		startedAt: '2026-11-10T14:31:55.420Z',
		finishedAt: '2026-11-10T14:36:12.078Z',
		failures: [],
		tests: [],
		scenarios: [
			{
				id: 'evidence-grid-review',
				status: 'passed',
				testedRevision: commit,
				inherited: false,
				origin: { record: recordId, commit },
				states
			}
		],
		measurements: [],
		budgets: { findings: [] }
	});
}

const populatedRecord = recordWith([
	{ id: 'populated', coverage: 'required', captures: [desktopShot, mobileShot, audioCapture] }
]);
const emptyRecord = recordWith([{ id: 'empty', coverage: 'missing', captures: [] }]);
const detail = cast<HarnessRevision>({
	commit,
	registry: {
		available: true,
		units: [],
		graph: { edges: [] },
		scenarios: [
			{
				id: 'evidence-grid-review',
				states: [{ id: 'populated', coverage: 'required' }],
				viewports: [
					{ id: 'desktop', width: 1280, height: 800 },
					{ id: 'mobile', width: 390, height: 844 }
				]
			}
		]
	},
	comparison: null
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
	expect(videoSummary(invalid)).toEqual({ selectedRevision, freshness: 'current', sha256: shotSha });
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

test('Lists gallery items for screenshot and audio captures', () => {
	const items = harnessEvidence(detail, populatedRecord);
	const prefix = 'c41f0e9a-evidence-grid-review-populated';
	expect(gallerySummary(items).map((item) => item.id)).toEqual([
		`${prefix}-desktop-0`,
		`${prefix}-mobile-1`,
		`${prefix}-audio-2`
	]);
	expect(items.map((item) => item.missing)).toEqual([false, true, false]);
	expect(harnessEvidence(detail, emptyRecord)).toEqual([]);
	recordExampleCases(
		meta('harnessEvidence', 'lists-gallery-items-for-screenshot-and-audio-captures'),
		[
			{
				name: 'populated record yields one item per screenshot or audio capture',
				input: { detail, record: populatedRecord },
				output: gallerySummary(items)
			},
			{
				name: 'record without screenshot or audio captures yields no items',
				input: { detail, record: emptyRecord },
				output: []
			}
		]
	);
});

test('Names media files without the media folder prefix', () => {
	const names = [desktopShot, mobileShot, audioCapture].map(mediaFile);
	expect(names).toEqual([`${shotSha}.png`, '', `${audioSha}.wav`]);
	recordExampleCases(meta('mediaFile', 'names-media-files-without-the-media-folder-prefix'), [
		{ name: 'screenshot media keeps its file name', input: desktopShot, output: names[0] },
		{ name: 'missing media gives an empty name', input: mobileShot, output: names[1] },
		{ name: 'audio media keeps its file name', input: audioCapture, output: names[2] }
	]);
});
