import type { HarnessRevision, HarnessUnit } from '../src/models/Harness.types';
import type {
	FocusedAudioFixture,
	FocusedAudioRawCapture,
	FocusedAudioSlot
} from './focusedAudioExamples.types';
import { expect } from 'vitest';
import { expectFocusedImageAdmission } from './focusedImageAdmission';
import { catalogShot, screenOptions } from '../src/utils/entityScreens';
import { explorerEvidence } from '../src/utils/explorerEvidence';
import { scope } from './entityPlaces';
import { withFocused } from './entityStates';
import { capture, commits, ids, units } from './entityUnits';
const CASE = 'generate.initialized';
const CLASS_ID = 'app.service.clip';
const MEDIA = 'f'.repeat(64);
const BINDING = { unit: CLASS_ID, case: CASE, revision: commits.tip, sha256: MEDIA };
const page = units.find((unit) => unit.id === ids.page)!;
const forge = (patch: object) => ({ note: JSON.stringify({ ...BINDING, ...patch }) });
/** Authored forgeries, each breaking one part of a valid capture; the valid control must survive. */
const REJECTED: Array<[string, Record<string, unknown>]> = [
	['forged-sha', forge({ sha256: 'e'.repeat(64) })],
	['forged-revision', forge({ revision: commits.first })],
	['forged-unit', forge({ unit: 'app.service.other' })],
	['extra-key', forge({ extra: true })],
	['partial-key', { note: JSON.stringify({ unit: CLASS_ID, case: CASE }) }],
	['malformed', { note: '{"unit":' }],
	['missing-note', { note: undefined }],
	['zero-bytes', { bytes: 0 }],
	['wrong-media', { mediaType: 'image/png' }],
	['zero-duration', { durationSeconds: 0 }],
	['unlisted-provenance', { provenance: 'screenshot-tool' }],
	['missing-media', { media: null }],
	['unexpected-viewport', { viewport: 'desktop' }],
	['failed-artifact', { status: 'failed' }],
	['empty-transcript', { transcript: '' }],
	['empty-case', forge({ case: '' })],
	['non-string-case', forge({ case: 17 })]
];
/** Synthetic sealed-audio metadata only; this fixture produces no recording or passing verdict. */
export function focusedAudioFixture(
	detail: HarnessRevision,
	slots: FocusedAudioSlot[] = [{ evidence: 'generated-clip', caseId: CASE }],
	status: 'passed' | 'failed' = 'passed'
): FocusedAudioFixture {
	const unit: HarnessUnit = {
		...detail.registry.units[0],
		id: CLASS_ID,
		kind: 'service',
		title: 'ClipService',
		owns: { source: ['src/services/ClipService.ts'], symbols: ['ClipService.generate'] },
		sourceFiles: [],
		testFiles: []
	};
	const captures = slots.map((slot) => syntheticAudioCapture(detail.commit, unit.id, slot));
	return {
		unit,
		detail: {
			...detail,
			records: [],
			registry: { ...detail.registry, units: [...detail.registry.units, unit] },
			regressions: [
				{
					loop: 'synthetic-class-audio',
					units: [unit.id],
					red: null,
					green: {
						id: 'synthetic-class-audio-record',
						commit: detail.commit,
						status,
						command: 'synthetic class artifact fixture',
						assertion: 'authored audio selection matrix',
						output: 'synthetic metadata only',
						finishedAt: '2026-10-21T10:00:00Z',
						captures
					}
				}
			]
		}
	};
}

function syntheticAudioCapture(
	commit: string,
	unit: string,
	{ evidence, caseId, provenance = 'fixture' }: FocusedAudioSlot
): FocusedAudioRawCapture {
	const seed = capture(commit, { kind: 'audio', state: 'generated' });
	const audio = {
		...seed,
		kind: 'audio' as const,
		provenance,
		evidence,
		bytes: 1,
		note: JSON.stringify({ unit, case: caseId, revision: commit, sha256: seed.sha256 })
	};
	return { unit, capture: audio };
}

/** Authored class-audio matrix; the squash case runs it so every row sits inside that one case. */
export function expectClassAudioMatrix(
	head: HarnessRevision,
	tip: HarnessRevision,
	sourceTree: string
) {
	expectFocusedImageAdmission(tip);
	expectCurrentAudio(tip);
	expectInheritedAudio(head, sourceTree);
	expectFailedRunAudio(tip);
	expectDistinctSlots(tip);
	expectBothProvenances(tip);
	expectRejectedBindings(tip);
	expectImageAudioCoexistence(tip);
	expectAudioOnlyNoScenario(tip);
}

function classView(detail: HarnessRevision, unit: HarnessUnit) {
	return explorerEvidence(scope('current'), { head: detail, parent: null }, unit);
}
function classAudio(detail: HarnessRevision, unit: HarnessUnit) {
	const { after } = classView(detail, unit);
	return after.captures.filter((item) => item.capture.kind === 'audio');
}
function slotsOf<T extends { capture: { evidence: string } }>(items: T[]) {
	return items.map((item) => item.capture.evidence);
}

function expectCurrentAudio(tip: HarnessRevision) {
	const { unit, detail } = focusedAudioFixture(tip);
	const found = classAudio(detail, unit);
	expect(slotsOf(found), 'valid current class audio').toEqual(['generated-clip']);
	expect(found[0].current).toBe(true);
	expect(found[0].focused?.status).toBe('passed');
	expect(found[0].capture.status).toBe('passed');
}

function expectInheritedAudio(head: HarnessRevision, sourceTree: string) {
	const { unit, detail } = focusedAudioFixture(head);
	const point = detail.regressions![0];
	const squashed = {
		...detail,
		commit: commits.tip,
		side: `sides/${sourceTree}.json`,
		regressions: [{ ...point, green: { ...point.green!, sourceTree } }]
	};
	const found = classAudio(squashed, unit);
	expect(slotsOf(found), 'identical tree inherits').toEqual(['generated-clip']);
	expect(found[0].current).toBeFalsy();
	expect(found[0].inheritedFrom).toBe(commits.middle);
	expect(found[0].focused?.status).toBe('passed');
	const changed = { ...squashed, side: `sides/${'f'.repeat(40)}.json` };
	expect(classAudio(changed, unit), 'changed tree refuses').toEqual([]);
}

function expectFailedRunAudio(tip: HarnessRevision) {
	const { unit, detail } = focusedAudioFixture(tip, undefined, 'failed');
	const found = classAudio(detail, unit);
	expect(slotsOf(found), 'failed run stays visible').toEqual(['generated-clip']);
	expect(found[0].focused?.status, 'the run point stays failed').toBe('failed');
	expect(found[0].capture.status, 'the artifact keeps its own outcome').toBe('passed');
}

function expectDistinctSlots(tip: HarnessRevision) {
	const slots: FocusedAudioSlot[] = [
		{ evidence: 'generated-clip', caseId: CASE },
		{ evidence: 'generated-tail', caseId: CASE },
		{ evidence: 'generated-clip', caseId: 'generate.cancelled' }
	];
	const { unit, detail } = focusedAudioFixture(tip, slots);
	const found = classAudio(detail, unit);
	expect(slotsOf(found).sort()).toEqual(['generated-clip', 'generated-clip', 'generated-tail']);
	expect(found.every((item) => item.capture.state === 'generated')).toBe(true);
}

function expectBothProvenances(tip: HarnessRevision) {
	const slots: FocusedAudioSlot[] = [
		{ evidence: 'generated-clip', caseId: CASE, provenance: 'fixture' },
		{ evidence: 'live-clip', caseId: CASE, provenance: 'actual-capture' }
	];
	const { unit, detail } = focusedAudioFixture(tip, slots);
	const found = classAudio(detail, unit);
	const pairs = found.map((item) => `${item.capture.evidence}:${item.capture.provenance}`);
	expect(pairs.sort()).toEqual(['generated-clip:fixture', 'live-clip:actual-capture']);
}

function expectRejectedBindings(tip: HarnessRevision) {
	const { unit, detail } = focusedAudioFixture(tip);
	const forged = REJECTED.map(([evidence, patch]) => {
		const raw = syntheticAudioCapture(tip.commit, unit.id, { evidence, caseId: CASE });
		return { unit: raw.unit, capture: { ...raw.capture, ...patch } };
	});
	const point = detail.regressions![0];
	const captures = [...point.green!.captures!, ...forged];
	const mixed = { ...detail, regressions: [{ ...point, green: { ...point.green!, captures } }] };
	expect(slotsOf(classAudio(mixed, unit)), 'forgeries are refused').toEqual(['generated-clip']);
}

function expectImageAudioCoexistence(tip: HarnessRevision) {
	const { unit, detail } = focusedAudioFixture(tip);
	const shots = withFocused(tip, ids.page, {}, true);
	const shot = shots.regressions![0];
	const audio = detail.regressions![0].green!.captures!;
	const green = { ...shot.green!, captures: [...shot.green!.captures!, ...audio] };
	const registry = { ...shots.registry, units: [...shots.registry.units, unit] };
	const regression = { ...shot, units: [ids.page, unit.id], green };
	const mixed = { ...shots, registry, regressions: [regression] };
	const pageView = explorerEvidence(scope('current'), { head: mixed, parent: null }, page);
	expect(catalogShot(pageView), 'image stays beside class audio').not.toBeNull();
	const states = pageView.after.captures.map((item) => item.capture.state);
	expect(states).toEqual(['default-desktop', 'default-tablet', 'default-mobile']);
	const kinds = classView(mixed, unit).after.captures.map((item) => item.capture.kind);
	expect(kinds, 'class view holds only its own audio').toEqual(['audio']);
}

function expectAudioOnlyNoScenario(tip: HarnessRevision) {
	const { unit, detail } = focusedAudioFixture(tip);
	const view = classView(detail, unit);
	expect(screenOptions(view.scenarios), 'no visual scenario').toEqual([]);
	expect(catalogShot(view), 'no screenshot').toBeNull();
}
