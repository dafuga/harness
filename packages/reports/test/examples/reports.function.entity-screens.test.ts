import { test } from 'vitest';
import {
	catalogShot,
	entityScreens,
	galleryItems,
	screenOptions,
	screenPick
} from '../../src/utils/explorer-ui/entityScreens';
import type { Evidence } from '../../src/models/reports-media/Report.types';
import { evidence } from '../utils/entityScreenFixture';
import { record, revision } from '../entityFixture';
import { commits, ids, scenarios, units } from '../entityUnits';
import { withFocused } from '../entityStates';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';
import type { Case } from './reports.function.entity-screens.test.types';

const unitId = 'reports.function.entity-screens';
const page = units.find((unit) => unit.id === ids.page)!;
const filter = units.find((unit) => unit.id === ids.filter)!;
const head = revision(commits.middle, [record(commits.middle)]);
const base = revision(commits.first, [record(commits.first, false)]);
const tip = revision(commits.tip, [record(commits.tip)]);
const options = screenOptions(scenarios.filter((item) => item.units.includes(ids.page)));
const mobileEmpty = { scenario: 'orders-page', state: 'empty', viewport: 'mobile' };

/** The fields that name an item's scenario, state, viewport, file and standing. */
function shownOf(item: Evidence | null | undefined) {
	if (!item) return null;
	return {
		category: item.category,
		state: item.state,
		viewport: item.viewport,
		file: item.file,
		phase: item.phase,
		order: item.order,
		missing: item.missing,
		status: item.status,
		source: item.source,
		standing: item.standing,
		note: item.note
	};
}

/** Records one named symbol's cases as a trace of their inputs and observed results. */
function traceCases(symbol: string, state: string, list: Case[]): void {
	recordExampleCases(
		{ unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		list.map(([name, input, output]) => ({ name, input, output }))
	);
}

const optionState = 'entity-screens-options-required-states-and-sized-viewports';
test('a visual scenario offers only its required states and sized viewports; a function offers none', () => {
	const found = {
		page: options,
		filter: screenOptions(scenarios.filter((item) => item.units.includes(ids.filter)))
	};
	expect(found.page).toEqual([
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
	expect(found.filter, 'a function names no visual scenario').toEqual([]);
	traceCases('screenOptions', optionState, [
		['visual page offers required states', { unit: ids.page }, found.page],
		['function offers no choice', { unit: ids.filter }, found.filter]
	]);
});

const pickState = 'entity-screens-pick-exact-and-first-choice-fallback';
test('a wanted scenario, state and viewport are picked exactly; an unavailable one falls back to the first choice', () => {
	const found = {
		exact: screenPick(options, mobileEmpty),
		unknownState: screenPick(options, { ...mobileEmpty, state: 'uncaptured' }),
		unknownViewport: screenPick(options, { ...mobileEmpty, viewport: 'tablet' }),
		unknownScenario: screenPick(options, { scenario: 'other', state: 'empty', viewport: 'mobile' }),
		noOptions: screenPick([], mobileEmpty)
	};
	expect(found.exact).toEqual(mobileEmpty);
	expect(found.unknownState).toEqual({ ...mobileEmpty, state: 'default' });
	expect(found.unknownViewport).toEqual({ ...mobileEmpty, viewport: 'desktop' });
	expect(found.unknownScenario).toEqual(mobileEmpty);
	expect(found.noOptions, 'an empty list picks nothing').toBeNull();
	traceCases('screenPick', pickState, [
		['exact scenario state viewport', mobileEmpty, found.exact],
		['unknown state falls back', { state: 'uncaptured' }, found.unknownState],
		['unknown viewport falls back', { viewport: 'tablet' }, found.unknownViewport],
		['unknown scenario uses first option', { scenario: 'other' }, found.unknownScenario],
		['no options is null', { options: [] }, found.noOptions]
	]);
});

const tipState = 'entity-screens-tip-exact-state-and-viewport-capture';
test('the branch tip shows exactly the picked state and viewport as its own fresh capture', () => {
	const shown = entityScreens(evidence(page, tip), mobileEmpty);
	expect(shown.before, 'the tip has no parent pane').toBeUndefined();
	expect(shown.after).toMatchObject({
		category: 'orders-page',
		state: 'empty',
		viewport: 'mobile',
		file: 'c725e93-empty-mobile.png',
		missing: false,
		phase: 'current'
	});
	expect(shown.fresh).toBe(true);
	traceCases('entityScreens', tipState, [
		['tip picked capture', mobileEmpty, { after: shownOf(shown.after), fresh: shown.fresh }]
	]);
});

const initialState = 'entity-screens-commit-without-parent-gap-names-initial';
test('a first commit has no parent pane, so its before side is a gap noted with the initial commit', () => {
	const parentless = evidence(page, head, null);
	const pick = { scenario: 'orders-page', state: 'default', viewport: 'desktop' };
	const shown = entityScreens(parentless, pick);
	expect(parentless.initial, 'the host names the first commit').toBeTruthy();
	expect(shown.before).toMatchObject({ missing: true, file: '', phase: 'before' });
	expect(shown.before?.note, 'the before gap takes the initial note').toBe(parentless.initial);
	expect(shown.after.file).toBe('8b41d07-default-desktop.png');
	traceCases('entityScreens', initialState, [
		[
			'first commit before gap',
			{ parent: null, pick },
			{ before: shownOf(shown.before), after: shownOf(shown.after) }
		]
	]);
});

const undeclaredState = 'entity-screens-function-without-scenario-has-no-screenshot';
test('a function names no scenario: its gap says so, and no screenshot is fabricated for it', () => {
	const found = evidence(filter, tip);
	const shown = entityScreens(found, null);
	expect(shown.after).toMatchObject({
		title: 'No screenshot',
		category: '',
		file: '',
		missing: true,
		status: 'not-proven'
	});
	expect(shown.after.note).toContain('No scenario with a viewport names this entity');
	expect(galleryItems(found), 'the gallery shows no picture of a function').toEqual([]);
	expect(catalogShot(found), 'the catalog has no image for a function').toBeNull();
	traceCases('entityScreens', undeclaredState, [
		['no picked scenario', { pick: null }, shownOf(shown.after)]
	]);
});

const missingState = 'entity-screens-missing-media-stays-a-gap-not-a-substitute';
test('a screenshot without media is missing and is never replaced by a sibling picture', () => {
	const broken: ReturnType<typeof evidence> = JSON.parse(JSON.stringify(evidence(page, tip)));
	const target = broken.after.captures.find(
		(entry) => entry.state === 'empty' && entry.capture.viewport === 'mobile'
	)!;
	target.capture.media = null;
	const picked = entityScreens(broken, mobileEmpty);
	expect(picked.after).toMatchObject({
		missing: true,
		file: '',
		state: 'empty',
		viewport: 'mobile'
	});
	expect(catalogShot(broken, mobileEmpty), 'no preview image without media').toBeNull();
	const sibling = catalogShot(broken, { ...mobileEmpty, state: 'default' });
	expect(sibling?.file, 'the other state keeps its own picture').toBe('c725e93-default-mobile.png');
	traceCases('catalogShot', missingState, [
		['empty mobile without media', mobileEmpty, shownOf(catalogShot(broken, mobileEmpty))],
		['default mobile keeps its picture', { state: 'default' }, shownOf(sibling)]
	]);
});

const previewState = 'entity-screens-catalog-preview-exact-or-explicit-focused-fallback';
test('a catalog preview shows its exact choice; focused captures appear only through the explicit fallback', () => {
	const preview = { scenario: 'orders-page', state: 'uncaptured', viewport: 'mobile' };
	const exact = catalogShot(evidence(page, tip), mobileEmpty);
	const focusedShown = evidence(page, withFocused(tip, ids.page));
	const found = {
		strict: catalogShot(focusedShown, preview),
		focusedDefault: catalogShot(focusedShown, preview, true)
	};
	expect(exact?.file).toBe('c725e93-empty-mobile.png');
	expect(found.strict, 'an unavailable preview state is a gap').toBeNull();
	expect(found.focusedDefault, 'the explicit fallback keeps the focused standing').toMatchObject({
		standing: 'Focused capture',
		status: 'not-proven'
	});
	traceCases('catalogShot', previewState, [
		['declared preview exact', mobileEmpty, shownOf(exact)],
		['unavailable preview is null', preview, shownOf(found.strict)],
		[
			'explicit focused fallback',
			{ ...preview, allowFocusedDefault: true },
			shownOf(found.focusedDefault)
		]
	]);
});

const orderState = 'entity-screens-gallery-before-then-after-with-order';
test('the gallery lists every screenshot of both commit sides, before first, with its own order', () => {
	const items = galleryItems(evidence(page, head, base));
	expect(items.map((item) => item.phase).join(' ')).toBe('before before after after after after');
	expect(items.map((item) => item.order)).toEqual([0, 1, 2, 3, 4, 5]);
	expect(new Set(items.map((item) => item.id)).size, 'each capture is one item').toBe(items.length);
	expect(items.every((item) => item.mediaType === 'image')).toBe(true);
	expect(galleryItems(evidence(page, tip)).every((item) => item.phase === 'current')).toBe(true);
	traceCases('galleryItems', orderState, [
		['head against base', { parent: commits.first }, items.map(shownOf)]
	]);
});
