import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	focusedCaptures,
	withoutViewportSuffix,
	focusedScenario
} from '../../src/utils/explorer-ui/explorer-evidence/focusedCaptures';

type Detail = Parameters<typeof focusedCaptures>[0];
type Side = NonNullable<Parameters<typeof focusedScenario>[0][number]>;
type Size = { width: number; height: number };

const UNIT = 'reports.component.evidence-grid';
const OTHER_UNIT = 'reports.function.entity-behavior';
const HEAD = '5b7e2c94a1d08f3e6b29c4a7d1e05f8b3c6a9d20';
const PARENT = '0c9d7e21f4a83b56c2e9d07a1f6b43e8d5c2a7f0';
const OLD = 'a3f19c0d7e52b84f6c1d9a07e3b5f28c4d6e1a90';
const TREE = 'e8d4b27c91f03a56d2e7b84c0f19a3d5c6b28e71';
const OTHER_TREE = '1f7a3c9e05b2d84f6a1c0e97b3d5f28a4c6e1d90';
const BUILD = '3e9a5c1fb7d20e64a81c9f37d05b2e8a6f4c1d93e7a0b25c98d13f6e0c4a7b21';
const DESKTOP: Size = { width: 1440, height: 900 };
const MOBILE: Size = { width: 390, height: 844 };
const DESKTOP_DECL = { id: 'desktop', width: 1440, height: 900 };
const MOBILE_DECL = { id: 'mobile', width: 390, height: 844 };
const META = {
	unitId: 'reports.function.explorer-evidence-focused-captures',
	evidence: 'examples-cases'
};

function shot(state: string, viewport: string, revision: string, size: Size) {
	const server = { buildId: BUILD, revision };
	const capture = {
		evidence: 'evidence-grid-focus',
		kind: 'screenshot',
		state,
		viewport,
		status: 'passed',
		path: `focused/${state}.png`,
		sha256: `sha-${state}`,
		mediaType: 'image/png',
		capturedAt: '2026-11-10T14:21:58.902Z',
		provenance: 'actual-capture',
		server,
		media: `media/${state}.png`
	};
	return { unit: UNIT, capture, viewport: size };
}

type PointInput = {
	commit: string;
	tree: string;
	id: string;
	status: string;
	finishedAt: string;
	captures: unknown[];
};

function point({ commit, tree, id, status, finishedAt, captures }: PointInput) {
	const command = 'pnpm exec playwright test tests/e2e/evidence-grid.spec.ts';
	return {
		commit,
		sourceTree: tree,
		id,
		status,
		command,
		assertion: 'evidence grid screenshots match the focused baseline',
		output: `${status} (fixture)`,
		finishedAt,
		captures
	};
}

function regression(loop: string, green: unknown, red: unknown = null) {
	return { loop, units: [UNIT], red, green };
}

function detail(
	commit: string,
	extra: { side?: string; sourceTree?: string; regressions?: unknown[] } = {}
): Detail {
	const registry = { available: true, units: [], scenarios: [], graph: { edges: [] } };
	return {
		commit,
		...extra,
		registry,
		comparison: null,
		regressions: extra.regressions
	} as unknown as Detail;
}

function summary(found: ReturnType<typeof focusedCaptures>) {
	return found.map((item) => {
		const view = item as unknown as {
			state: string;
			standing: string;
			usable: boolean;
			current: boolean;
			inheritedFrom: string | null;
			capture: { viewport?: string };
			focused?: { loop: string; record: string };
		};
		return {
			loop: view.focused?.loop,
			state: view.state,
			viewport: view.capture.viewport,
			standing: view.standing,
			usable: view.usable,
			current: view.current,
			inheritedFrom: view.inheritedFrom,
			record: view.focused?.record
		};
	});
}

function focusedItem(state: string, viewport: string, size?: Size) {
	const focused = {
		loop: 'catalog-captures',
		status: 'passed',
		record: 'd4e1a07c',
		viewport: size
	};
	return {
		scenario: 'focused',
		state,
		capture: { viewport },
		standing: 'unvalidated',
		usable: true,
		current: true,
		inheritedFrom: null,
		focused
	};
}

function side(commit: string, captures: unknown[]): Side {
	const declared = [
		{
			id: 'evidence-grid-states',
			title: 'Evidence grid states',
			kind: 'ui',
			units: [UNIT],
			states: [{ id: 'populated-list', coverage: 'required' }],
			viewports: [DESKTOP_DECL, MOBILE_DECL],
			tests: []
		}
	];
	const registry = { available: true, units: [], scenarios: declared, graph: { edges: [] } };
	return {
		commit,
		detail: { commit, registry, comparison: null, records: [], explanations: [] },
		record: null,
		captures,
		coverage: [],
		gap: null
	} as unknown as Side;
}

test('Same-commit focused captures are selected', () => {
	const green = point({
		commit: HEAD,
		tree: TREE,
		id: 'd4e1a07c',
		status: 'passed',
		finishedAt: '2026-11-10T14:23:41.117Z',
		captures: [
			shot('populated-list-desktop', 'desktop', HEAD, DESKTOP),
			shot('populated-list-mobile', 'mobile', HEAD, MOBILE)
		]
	});
	const head = detail(HEAD, {
		sourceTree: TREE,
		regressions: [regression('catalog-captures', green)]
	});
	const row = (viewport: string) => ({
		loop: 'catalog-captures',
		state: 'populated-list',
		viewport,
		standing: 'unvalidated',
		usable: true,
		current: true,
		inheritedFrom: null,
		record: 'd4e1a07c'
	});
	const expected = [row('desktop'), row('mobile')];
	expect(summary(focusedCaptures(head, UNIT))).toEqual(expected);
	expect(focusedCaptures(head, OTHER_UNIT)).toEqual([]);
	expect(focusedCaptures(detail(HEAD), UNIT)).toEqual([]);
	recordExampleCases(
		{
			...META,
			symbol: 'focusedCaptures',
			state: 'same-commit-focused-captures-are-selected',
			file: 'same-commit-focused-captures-are-selected.json'
		},
		[
			{
				name: 'same commit screenshots for the unit',
				input: { commit: HEAD, unit: UNIT },
				output: expected
			},
			{
				name: 'same commit asked for another unit',
				input: { commit: HEAD, unit: OTHER_UNIT },
				output: []
			},
			{
				name: 'revision without regression points',
				input: { commit: HEAD, regressions: null },
				output: []
			}
		]
	);
});

test('Identical source tree inherits and skips other trees', () => {
	const red = point({
		commit: OLD,
		tree: TREE,
		id: '7f0c2b9e',
		status: 'failed',
		finishedAt: '2026-11-09T18:05:12.440Z',
		captures: [shot('empty-state-desktop', 'desktop', OLD, DESKTOP)]
	});
	const otherTree = point({
		commit: OLD,
		tree: OTHER_TREE,
		id: '9b2e5f10',
		status: 'passed',
		finishedAt: '2026-11-12T09:00:00.000Z',
		captures: [shot('empty-state-mobile', 'mobile', OLD, MOBILE)]
	});
	const sideDetail = detail(PARENT, {
		side: `sides/${TREE}.json`,
		regressions: [
			regression('modules-horizontal-navbar', null, red),
			regression('other-tree', otherTree)
		]
	});
	const expected = [
		{
			loop: 'modules-horizontal-navbar',
			state: 'empty-state-desktop',
			viewport: 'desktop',
			standing: 'unvalidated',
			usable: true,
			current: false,
			inheritedFrom: OLD,
			record: '7f0c2b9e'
		}
	];
	expect(summary(focusedCaptures(sideDetail, UNIT))).toEqual(expected);
	expect(focusedCaptures(detail(PARENT, { side: `sides/${TREE}.json` }), UNIT)).toEqual([]);
	recordExampleCases(
		{
			...META,
			symbol: 'focusedCaptures',
			state: 'identical-source-tree-inherits-and-skips-other-trees',
			file: 'identical-source-tree-inherits-and-skips-other-trees.json'
		},
		[
			{
				name: 'side file names the identical source tree',
				input: { commit: PARENT, side: `sides/${TREE}.json`, unit: UNIT },
				output: expected
			},
			{
				name: 'side revision without regressions',
				input: { commit: PARENT, regressions: null },
				output: []
			}
		]
	);
});

test('Viewport suffix removal is exact', () => {
	const cases = [
		{ state: 'populated-list-desktop', viewport: 'desktop', output: 'populated-list' },
		{ state: 'empty-state', viewport: '', output: 'empty-state' },
		{ state: 'mobile-list-desktop', viewport: 'mobile', output: 'mobile-list-desktop' }
	];
	for (const item of cases)
		expect(withoutViewportSuffix(item.state, item.viewport)).toBe(item.output);
	recordExampleCases(
		{
			...META,
			symbol: 'withoutViewportSuffix',
			state: 'viewport-suffix-removal-is-exact',
			file: 'viewport-suffix-removal-is-exact.json'
		},
		cases.map((item) => ({
			name: `state ${item.state} with viewport ${item.viewport || 'empty'}`,
			input: { state: item.state, viewport: item.viewport },
			output: item.output
		}))
	);
});

test('Focused scenario lists states and viewports', () => {
	const sideA = side(HEAD, [
		focusedItem('populated-list', 'desktop', DESKTOP),
		focusedItem('populated-list', 'mobile', MOBILE),
		focusedItem('populated-list', 'tablet')
	]);
	const expected = [
		{
			id: 'focused',
			title: 'Focused screenshots',
			kind: 'focused',
			units: [UNIT],
			tests: [],
			states: [{ id: 'populated-list', coverage: 'required' }],
			viewports: [
				{ id: 'desktop', width: 1440, height: 900 },
				{ id: 'mobile', width: 390, height: 844 },
				{ id: 'tablet', width: 920, height: 800 }
			]
		}
	];
	expect(focusedScenario([sideA, null], UNIT)).toEqual(expected);
	expect(focusedScenario([null, null], UNIT)).toEqual([]);
	recordExampleCases(
		{
			...META,
			symbol: 'focusedScenario',
			state: 'focused-scenario-lists-states-and-viewports',
			file: 'focused-scenario-lists-states-and-viewports.json'
		},
		[
			{
				name: 'desktop, mobile and tablet focused captures',
				input: { unit: UNIT, sides: [`side:${HEAD}`, null] },
				output: expected
			},
			{
				name: 'no side holds a focused capture',
				input: { unit: UNIT, sides: [null, null] },
				output: []
			},
			{
				name: 'other unit uses recorded sizes',
				input: { unit: OTHER_UNIT, sides: [`side:${HEAD}`, null] },
				output: focusedScenario([sideA, null], OTHER_UNIT)
			}
		]
	);
});
