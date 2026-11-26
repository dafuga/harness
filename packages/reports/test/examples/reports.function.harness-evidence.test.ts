import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { mediaFile, harnessEvidence } from '../../src/utils/explorer-ui/harnessEvidence';
import type { HarnessCapture, HarnessRecord } from '../../src/models/explorer-ui/Harness.types';
import type { HarnessRevision } from '../../src/models/explorer-ui/HarnessRevision.types';
import {
	cast,
	desktopShot,
	pathBase,
	recordId,
	commit,
	meta,
	shotSha
} from './reports.function.harness-evidence.cases';

const mobileSha = '5d0e8b3af61c9274b0d5e8a17c3f6920e4b1d7a508f3c6e29b4a1d70c6e5f283';
const audioSha = '2e9b47c1a86d0f35d1c7e4b9f0a2836d5c4e1b7a93d8f6e0b2a5c18f4d7e0a39';

function gallerySummary(items: ReturnType<typeof harnessEvidence>) {
	return items.map((item) => ({
		id: item.id,
		file: item.file,
		status: item.status,
		viewport: item.viewport,
		missing: item.missing,
		mediaType: item.mediaType
	}));
}
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

test('Throws TypeError when a media name is not a string', () => {
	const broken = cast<HarnessCapture>({ ...desktopShot, media: 42 });
	expect(() => mediaFile(broken)).toThrow(TypeError);
	recordExampleCases(meta('mediaFile', 'throws-typeerror-when-a-media-name-is-not-a-string'), [
		{ name: 'numeric media value throws TypeError', input: { media: 42 }, error: 'TypeError' }
	]);
});

test('Throws TypeError when the registry has no scenarios', () => {
	const bare = cast<HarnessRevision>({
		...detail,
		registry: { available: false, units: [], graph: { edges: [] } }
	});
	expect(() => harnessEvidence(bare, populatedRecord)).toThrow(TypeError);
	recordExampleCases(
		meta('harnessEvidence', 'throws-typeerror-when-the-registry-has-no-scenarios'),
		[
			{
				name: 'registry without scenarios throws TypeError',
				input: { registry: { available: false }, record: 'populated' },
				error: 'TypeError'
			}
		]
	);
});

test('Throws TypeError when the record has no scenarios', () => {
	const bare = cast<HarnessRecord>({ ...populatedRecord, scenarios: undefined });
	expect(() => harnessEvidence(detail, bare)).toThrow(TypeError);
	recordExampleCases(meta('harnessEvidence', 'throws-typeerror-when-the-record-has-no-scenarios'), [
		{
			name: 'record without scenarios throws TypeError',
			input: { record: { id: recordId } },
			error: 'TypeError'
		}
	]);
});
