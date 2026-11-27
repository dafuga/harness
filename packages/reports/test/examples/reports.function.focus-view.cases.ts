import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { focusView } from '../../src/components/explorer-ui/harness-map/focusView';
import { pad, wholeView } from '../../src/utils/explorer-ui/focusView';
import type { Layout, Unit, Edges } from './reports.function.focus-view.test.types';

export function node(id: string, x: number, y: number): Layout['nodes'][number] {
	return { unit: { id } as Unit, x, y };
}

export function layout(
	nodes: Layout['nodes'],
	edges: Edges = [],
	width = 360,
	height = 200
): Layout {
	return { width, height, nodes, edges };
}

test('Whole view is returned when no or all units match', () => {
	const map = layout([node('a', 0, 0), node('b', 400, 0)], [], 800, 200);
	const whole = { x: -pad, y: -pad, width: 848, height: 248 };
	const none = focusView(map, new Set(['missing']));
	const all = focusView(map, new Set(['a', 'b']));
	expect(none).toEqual(whole);
	expect(all).toEqual(whole);
	expect(wholeView(map)).toEqual(whole);
	recordExampleCases(
		{
			unitId: 'reports.function.focus-view',
			symbol: 'focusView',
			state: 'whole-view-is-returned-when-no-or-all-units-match',
			evidence: 'examples-cases',
			file: 'whole-view-is-returned-when-no-or-all-units-match.json'
		},
		[
			{ name: 'no unit matches the ids', input: { ids: ['missing'] }, output: none },
			{ name: 'every unit matches the ids', input: { ids: ['a', 'b'] }, output: all }
		]
	);
});
