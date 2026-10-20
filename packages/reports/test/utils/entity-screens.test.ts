import { expect, test } from 'vitest';
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

const page = units.find((unit) => unit.id === ids.page)!;
const head = revision(commits.middle, [record(commits.middle)]);
const base = revision(commits.first, [record(commits.first, false)]);
const tip = revision(commits.tip, [record(commits.tip)]);
const options = screenOptions(scenarios.filter((item) => item.units.includes(ids.page)));
type Revision = typeof head;
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
	expect(shown.before).toMatchObject({ missing: true, file: '', status: 'not-proven' });
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
	expect(shown.after).toMatchObject({ missing: true, file: '', phase: 'current' });
	expect(shown.after.note).toContain('inherited from aaaaaaa');
});

test('the gallery gets every screenshot of both sides, each side marked as what it is', () => {
	const items = galleryItems(evidence(page, head, base));
	expect(items.filter((item) => item.phase === 'after')).toHaveLength(4);
	expect(items.filter((item) => item.phase === 'before')).toHaveLength(2);
	const current = galleryItems(evidence(page, tip));
	expect(current).toHaveLength(4);
	expect(current.every((item) => item.phase === 'current')).toBe(true);
	// A revision shown as the tip that is not the tip has nothing of its own to show as current.
	expect(galleryItems(evidence(page, head))).toEqual([]);
	expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
});

test('a declared catalog preview selects its exact state and viewport without a fallback', () => {
	const shown = evidence(page, tip);
	const preview = { scenario: 'orders-page', state: 'empty', viewport: 'mobile' };
	expect(catalogShot(shown, preview)?.file).toBe('ccccccc-empty-mobile.png');
	expect(catalogShot(shown, { ...preview, state: 'uncaptured' })).toBeNull();
});

test('validated unchanged screenshots stay visible with their capture origin', () => {
	const unchanged = {
		...tip,
		sourceImpact: { ...tip.sourceImpact!, units: { ...tip.sourceImpact!.units, indirect: [] } }
	};
	const inherited = withInherited(unchanged, commits.middle);
	const usable = evidence(page, inherited);
	expect(usable.after.captures[0].usable, 'fixture has validated unchanged proof').toBe(true);
	const shown = entityScreens(usable, screenPick(options, {})!);
	expect(shown.after).toMatchObject({ missing: false, file: 'bbbbbbb-default-desktop.png' });
	expect(shown.fresh).toBe(false);
	expect(shown.origin).toBe(commits.middle);
	expect(shown.after.source).toBe(commits.middle);
});
