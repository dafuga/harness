import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	focusView,
	focusOn,
	zoomView,
	panView,
	drawnEdges,
	nextNode
} from '../../src/components/explorer-ui/harness-map/focusView';
import { pad, wholeView } from '../../src/utils/explorer-ui/focusView';
import type { MapView } from '../../src/utils/explorer-ui/focusView.types';

type Layout = Parameters<typeof focusOn>[0];
type Edges = Layout['edges'];
type Unit = Layout['nodes'][number]['unit'];

function node(id: string, x: number, y: number): Layout['nodes'][number] {
	return { unit: { id } as Unit, x, y };
}

function layout(
	nodes: Layout['nodes'],
	edges: Edges = [],
	width = 360,
	height = 200
): Layout {
	return { width, height, nodes, edges };
}

function row(count: number): Layout['nodes'] {
	return Array.from({ length: count }, (_, index) => node(`u${index}`, index * 10, 0));
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

test('Focus view bounds a matched unit inside the whole map', () => {
	const map = layout(
		[node('a', 0, 0), node('b', 400, 0), node('c', 800, 0), node('d', 1200, 0)],
		[],
		1400,
		300
	);
	const whole = wholeView(map);
	const view = focusView(map, new Set(['b']));
	expect(view.width).toBeLessThan(whole.width);
	expect(view.x).toBeLessThanOrEqual(400);
	expect(view.x + view.width).toBeGreaterThan(400);
	recordExampleCases(
		{
			unitId: 'reports.function.focus-view',
			symbol: 'focusView',
			state: 'focus-view-bounds-a-matched-unit-inside-the-whole-map',
			evidence: 'examples-cases',
			file: 'focus-view-bounds-a-matched-unit-inside-the-whole-map.json'
		},
		[
			{
				name: 'one of four units in a wide map is matched',
				input: { width: 1400, height: 300, ids: ['b'] },
				output: view
			}
		]
	);
});

test('Focus on applies only above sixty units', () => {
	const small = layout(row(60));
	const large = layout(row(61));
	const ids = new Set(['u5']);
	const smallFocus = focusOn(small, ids);
	const largeFocus = focusOn(large, ids);
	expect(smallFocus).toBeNull();
	expect(largeFocus).toEqual(focusView(large, ids));
	recordExampleCases(
		{
			unitId: 'reports.function.focus-view',
			symbol: 'focusOn',
			state: 'focus-on-applies-only-above-sixty-units',
			evidence: 'examples-cases',
			file: 'focus-on-applies-only-above-sixty-units.json'
		},
		[
			{ name: 'sixty nodes stays whole', input: { nodes: 60, ids: ['u5'] }, output: smallFocus },
			{
				name: 'sixty-one nodes uses focus rules',
				input: { nodes: 61, ids: ['u5'] },
				output: largeFocus
			}
		]
	);
});

test('Zoom and pan keep the viewport readable', () => {
	const view: MapView = { x: -24, y: -24, width: 408, height: 248 };
	const zoomed = zoomView(view, 1.25, view);
	const panned = panView(view, -18, 12);
	expect(zoomed.height / zoomed.width).toBeCloseTo(view.height / view.width);
	expect(zoomed.x + zoomed.width / 2).toBeCloseTo(view.x + view.width / 2);
	expect(zoomed.y + zoomed.height / 2).toBeCloseTo(view.y + view.height / 2);
	expect(panned).toEqual({ x: -42, y: -12, width: 408, height: 248 });
	recordExampleCases(
		{
			unitId: 'reports.function.focus-view',
			symbol: 'zoomView',
			state: 'zoom-and-pan-keep-the-viewport-readable',
			evidence: 'examples-cases',
			file: 'zoom-and-pan-keep-the-viewport-readable.json'
		},
		[
			{
				name: 'zoom in by 1.25 keeps the centre and aspect ratio',
				input: { view, factor: 1.25 },
				output: zoomed
			},
			{
				name: 'panView moves the view left and down without resizing',
				input: { view, dx: -18, dy: 12 },
				output: panned
			}
		]
	);
});

test("Large maps draw only the selected unit's edges", () => {
	const edges: Edges = [
		{ from: 'u0', to: 'u1', x1: 0, y1: 0, x2: 10, y2: 0 },
		{ from: 'u2', to: 'u3', x1: 20, y1: 0, x2: 30, y2: 0 }
	];
	const small = layout(row(3), edges);
	const large = layout(row(61), edges);
	const smallAll = drawnEdges(small, 'u2');
	const largeSelected = drawnEdges(large, 'u0');
	const largeNone = drawnEdges(large, null);
	expect(smallAll).toEqual(edges);
	expect(largeSelected).toEqual([edges[0]]);
	expect(largeNone).toEqual([]);
	recordExampleCases(
		{
			unitId: 'reports.function.focus-view',
			symbol: 'drawnEdges',
			state: "large-maps-draw-only-the-selected-unit-s-edges",
			evidence: 'examples-cases',
			file: 'large-maps-draw-only-the-selected-unit-s-edges.json'
		},
		[
			{ name: 'three-node map draws every edge', input: { nodes: 3, selected: 'u2' }, output: smallAll },
			{
				name: 'sixty-one-node map draws the selected unit edge',
				input: { nodes: 61, selected: 'u0' },
				output: largeSelected
			},
			{ name: 'sixty-one-node map with no selection draws none', input: { nodes: 61, selected: null }, output: largeNone }
		]
	);
});

test('Arrow keys move to the nearest shown unit ahead', () => {
	const map = layout([node('a', 0, 0), node('b', 400, 0), node('c', 400, 200), node('d', 0, 200)]);
	const shown = new Set(['a', 'b', 'c', 'd']);
	const right = nextNode(map, 'a', 'ArrowRight', shown);
	const down = nextNode(map, 'a', 'ArrowDown', shown);
	const left = nextNode(map, 'a', 'ArrowLeft', shown);
	const withoutB = nextNode(map, 'a', 'ArrowRight', new Set(['a', 'c', 'd']));
	const unknown = nextNode(map, 'a', 'Enter', shown);
	expect(right).toBe('b');
	expect(down).toBe('d');
	expect(left).toBe('a');
	expect(withoutB).toBe('c');
	expect(unknown).toBeUndefined();
	recordExampleCases(
		{
			unitId: 'reports.function.focus-view',
			symbol: 'nextNode',
			state: 'arrow-keys-move-to-the-nearest-shown-unit-ahead',
			evidence: 'examples-cases',
			file: 'arrow-keys-move-to-the-nearest-shown-unit-ahead.json'
		},
		[
			{ name: 'ArrowRight from a picks the same-row unit b', input: { from: 'a', key: 'ArrowRight' }, output: right },
			{ name: 'ArrowDown from a picks the same-column unit d', input: { from: 'a', key: 'ArrowDown' }, output: down },
			{ name: 'ArrowLeft at the edge stays on a', input: { from: 'a', key: 'ArrowLeft' }, output: left },
			{
				name: 'hidden unit b is skipped so c is chosen',
				input: { from: 'a', key: 'ArrowRight', shown: ['a', 'c', 'd'] },
				output: withoutB
			},
			{ name: 'unrecognized key returns undefined', input: { from: 'a', key: 'Enter' }, output: 'undefined' }
		]
	);
});
