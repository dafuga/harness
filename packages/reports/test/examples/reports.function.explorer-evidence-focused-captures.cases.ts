import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { focusedCaptures } from '../../src/utils/explorer-ui/explorer-evidence/focusedCaptures';
import type {
	Size,
	PointInput,
	Detail
} from './reports.function.explorer-evidence-focused-captures.test.types';

export const UNIT = 'reports.component.evidence-grid';
export const OTHER_UNIT = 'reports.function.entity-behavior';
export const HEAD = '5b7e2c94a1d08f3e6b29c4a7d1e05f8b3c6a9d20';
export const TREE = 'e8d4b27c91f03a56d2e7b84c0f19a3d5c6b28e71';
const BUILD = '3e9a5c1fb7d20e64a81c9f37d05b2e8a6f4c1d93e7a0b25c98d13f6e0c4a7b21';
export const DESKTOP: Size = { width: 1440, height: 900 };
export const MOBILE: Size = { width: 390, height: 844 };
export const META = {
	unitId: 'reports.function.explorer-evidence-focused-captures',
	evidence: 'examples-cases'
};

export function shot(state: string, viewport: string, revision: string, size: Size) {
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

export function point({ commit, tree, id, status, finishedAt, captures }: PointInput) {
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

export function regression(loop: string, green: unknown, red: unknown = null) {
	return { loop, units: [UNIT], red, green };
}

export function detail(
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

export function summary(found: ReturnType<typeof focusedCaptures>) {
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
