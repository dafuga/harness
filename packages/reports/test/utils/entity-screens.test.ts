import type { Revision } from './entity-screens.test.types';
import type { ExplorerEvidence } from '../../src/models/Explorer.types';
import { expect, test } from 'vitest';
import unit from '../../../../specification/units/reports.function.entity-screens.json';
import {
	catalogShot,
	entityScreens,
	galleryItems,
	screenOptions,
	screenPick
} from '../../src/utils/entityScreens';
import { explorerEvidence } from '../../src/utils/explorerEvidence';
import { record, revision } from '../entityFixture';
import { withInherited } from '../entityPreviewData';
import { scope } from '../entityPlaces';
import { commits, ids, scenarios, units } from '../entityUnits';
import { withFocused } from '../entityStates';
import { expectClassAudioMatrix, focusedAudioFixture } from '../focusedAudioExamples';
import { measureWorkload } from '../../../../test/support/measureWorkload';
import { withoutViewportSuffix } from '../../src/utils/explorer-ui/explorer-evidence/focusedCaptures';
const page = units.find((unit) => unit.id === ids.page)!;
const head = revision(commits.middle, [record(commits.middle)]);
const base = revision(commits.first, [record(commits.first, false)]);
const tip = revision(commits.tip, [record(commits.tip)]);
test('source-identical squash previews retain origin and reject a changed source tree', async () => {
	const captured = withFocused(head, ids.page);
	const sourceTree = 'e'.repeat(40);
	const point = { ...captured.regressions![0].green!, sourceTree };
	const squashed = {
		...captured,
		commit: commits.tip,
		side: `sides/${sourceTree}.json`,
		regressions: [{ ...captured.regressions![0], green: point }]
	};
	const found = evidence(page, squashed);
	expect(catalogShot(found), 'source-identical squash displays original screenshot').not.toBeNull();
	expect(catalogShot(found)?.source).toBe(commits.middle);
	expect(
		found.after.captures.every((item) => !item.current && item.inheritedFrom === commits.middle)
	).toBe(true);
	expect(
		catalogShot(evidence(page, { ...squashed, side: `sides/${'f'.repeat(40)}.json` }))
	).toBeNull();
	await measureWorkload(
		'reports.function.explorer-evidence-focused-captures',
		'focused-audio-binding-matrix',
		() => expectClassAudioMatrix(head, tip, sourceTree)
	);
});
test('device states share a picker while original metadata and missing-device gaps remain intact', () => {
	expect(withoutViewportSuffix('choose-mobile', 'desktop')).toBe('choose-mobile');
	const captured = withFocused(tip, ids.page, {}, true);
	const found = evidence(page, captured);
	const opts = screenOptions(found.scenarios);
	for (const viewport of ['desktop', 'tablet', 'mobile']) {
		expect(
			entityScreens(found, screenPick(opts, { scenario: 'focused', viewport })!).after.file
		).toBe(`ccccccc-default-${viewport}.png`);
	}
	expect(found.after.captures.map((item) => item.state)).toEqual(['default', 'default', 'default']);
	expect(found.after.captures.map((item) => item.capture.state)).toEqual([
		'default-desktop',
		'default-tablet',
		'default-mobile'
	]);
	captured.regressions![0].green!.captures = captured.regressions![0].green!.captures!.slice(0, 1);
	const alone = evidence(page, captured);
	expect(alone.after.captures[0].state).toBe('default-desktop');
	expect(
		entityScreens(alone, { scenario: 'focused', state: 'default-desktop', viewport: 'mobile' })
			.after.missing
	).toBe(true);
});
const options = screenOptions(scenarios.filter((item) => item.units.includes(ids.page)));
/** What the host gives for the page: the tip alone, or a commit beside the parent it names. */
function evidence(_unit: typeof page, shown: Revision, parent?: Revision | null) {
	if (parent === undefined)
		return explorerEvidence(scope('current'), { head: shown, parent: null }, page);
	const at = { ...scope('commit'), parent: parent ? parent.commit : null };
	return explorerEvidence(at, { head: shown, parent }, page);
}
test('a visual entity offers the states and viewports its scenario declares; a function offers none', () => {
	expect(options).toEqual([
		{
			scenario: 'orders-page',
			title: 'Orders page over synthetic orders',
			states: ['default', 'empty'],
			viewports: [
				{ id: 'desktop', label: 'Desktop', size: '1440 × 900' },
				{ id: 'mobile', label: 'Mobile', size: '390 × 844' }
			]
		}
	]);
	expect(screenOptions(scenarios.filter((item) => item.units.includes(ids.filter)))).toEqual([]);
});
test('the first state and viewport are shown until a person picks; an unknown pick is not kept', () => {
	expect(screenPick(options, {})).toEqual({
		scenario: 'orders-page',
		state: 'default',
		viewport: 'desktop'
	});
	expect(screenPick(options, { state: 'empty', viewport: 'tablet' })?.viewport).toBe('desktop');
	expect(screenPick([], {})).toBeNull();
});
test('the branch tip shows exactly one screenshot, the one of the picked state and viewport', () => {
	const pick = screenPick(options, { viewport: 'mobile' })!;
	const shown = entityScreens(evidence(page, tip), pick);
	expect(shown.before).toBeUndefined();
	expect(shown.after.file).toBe('ccccccc-default-mobile.png');
	expect(shown.after.missing).toBe(false);
	expect(shown.after.phase).toBe('current');
	expect(shown.fresh).toBe(true);
});
test('a selected commit pairs the parent and the commit for the same state and viewport', () => {
	const shown = entityScreens(evidence(page, head, base), screenPick(options, {})!);
	expect(shown.before?.file).toBe('aaaaaaa-default-desktop.png');
	expect(shown.after.file).toBe('bbbbbbb-default-desktop.png');
	expect([shown.before?.phase, shown.after.phase]).toEqual(['before', 'after']);
	expect(shown.before?.comparison).toBe(shown.after.comparison);
	expect(shown.after.standing).toBe('Fresh capture');
});
test('a side with no capture is a stated gap and is never filled from the other side', () => {
	const pick = screenPick(options, { state: 'empty' })!;
	const shown = entityScreens(evidence(page, head, base), pick);
	expect(shown.before).toMatchObject({
		missing: true,
		file: '',
		status: 'not-proven'
	});
	expect(shown.before?.note).toBe('No capture of empty at desktop is recorded for aaaaaaa.');
	expect(shown.before?.file).not.toContain('bbbbbbb');
	expect(shown.after.file).toBe('bbbbbbb-empty-desktop.png');
});
test('a revision without a record has a gap for its screenshot, in the words its side gives', () => {
	const shown = entityScreens(evidence(page, revision(commits.tip, [])), screenPick(options, {})!);
	expect(shown.after.missing).toBe(true);
	expect(shown.after.note).toMatch(/ccccccc|record/);
	expect(shown.after.file).toBe('');
	expect(shown.fresh).toBe(false);
});
test('a first commit has no before pane to fill: its parent side says why', () => {
	const shown = entityScreens(evidence(page, head, null), screenPick(options, {})!);
	expect(shown.before).toMatchObject({ missing: true, file: '' });
	expect(shown.before?.note).toContain('no parent');
});
test('an inherited capture is never the screenshot of the tip: it is a gap that names its origin', () => {
	const taken = record(commits.tip);
	const scenariosOf = taken.scenarios.map((scenario) => ({
		...scenario,
		inherited: true,
		origin: { record: 'rec-old', commit: commits.first }
	}));
	const inherited = revision(commits.tip, [{ ...taken, scenarios: scenariosOf }]);
	const shown = entityScreens(evidence(page, inherited), screenPick(options, {})!);
	expect(shown.fresh).toBe(false);
	expect(shown.origin).toBe(commits.first);
	// It is a gap of the tip, with where the capture on record came from, and no picture.
	expect(shown.after).toMatchObject({
		missing: true,
		file: '',
		phase: 'current'
	});
	expect(shown.after.note).toContain('inherited from aaaaaaa');
});
test('galleryItems: distinct class audio cases retain tested provenance', async () => {
	const items = galleryItems(evidence(page, head, base));
	expect(items.filter((item) => item.phase === 'after')).toHaveLength(4);
	expect(items.filter((item) => item.phase === 'before')).toHaveLength(2);
	const current = galleryItems(evidence(page, tip));
	expect(current).toHaveLength(4);
	expect(current.every((item) => item.phase === 'current')).toBe(true);
	// A revision shown as the tip that is not the tip has nothing of its own to show as current.
	expect(galleryItems(evidence(page, head))).toEqual([]);
	expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
	const example = unit.testing.examples[0];
	const projected = await measureWorkload(
		'reports.function.entity-screens',
		'audio-case-gallery',
		() => galleryItems(example.input[0] as unknown as ExplorerEvidence)
	);
	expect(projected, 'class audio cases must stay distinct and retain tested provenance').toEqual(
		example.expected.value
	);
	const fixture = focusedAudioFixture(tip, [
		{ evidence: 'generated-clip', caseId: 'generate.initialized' },
		{ evidence: 'generated-clip', caseId: 'generate.cancelled' }
	]);
	const audio = galleryItems(
		explorerEvidence(scope('current'), { head: fixture.detail, parent: null }, fixture.unit)
	);
	expect(audio).toHaveLength(2);
	expect(new Set(audio.map((item) => item.comparison)).size).toBe(2);
	expect(new Set(audio.map((item) => item.id)).size).toBe(2);
});
test('a declared catalog preview selects its exact state and viewport without a fallback', () => {
	const shown = evidence(page, tip);
	const preview = {
		scenario: 'orders-page',
		state: 'empty',
		viewport: 'mobile'
	};
	expect(catalogShot(shown, preview)?.file).toBe('ccccccc-empty-mobile.png');
	expect(catalogShot(shown, { ...preview, state: 'uncaptured' })).toBeNull();
	const focused = structuredClone(shown);
	for (const item of focused.after.captures) {
		item.scenario = 'focused';
		item.focused = {
			loop: 'standard-preview',
			status: 'passed',
			record: 'fixture'
		};
	}
	expect(
		catalogShot(focused, preview)?.file,
		'catalog preview keeps its declared state and viewport'
	).toBe('ccccccc-empty-mobile.png');
	expect(catalogShot(focused, { ...preview, state: 'uncaptured' })).toBeNull();
});
test('validated unchanged screenshots stay visible with their capture origin', () => {
	const unchanged = {
		...tip,
		sourceImpact: {
			...tip.sourceImpact!,
			units: { ...tip.sourceImpact!.units, indirect: [] }
		}
	};
	const inherited = withInherited(unchanged, commits.middle);
	const usable = evidence(page, inherited);
	expect(usable.after.captures[0].usable, 'fixture has validated unchanged proof').toBe(true);
	const shown = entityScreens(usable, screenPick(options, {})!);
	expect(shown.after).toMatchObject({
		missing: false,
		file: 'bbbbbbb-default-desktop.png'
	});
	expect(shown.fresh).toBe(false);
	expect(shown.origin).toBe(commits.middle);
	expect(shown.after.source).toBe(commits.middle);
});
