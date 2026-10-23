import { expect, test } from 'vitest';
import type { HarnessUnit } from '../../src/models/Harness.types';
import {
	harnessLayout,
	mapColumns
} from '../../src/components/explorer-ui/harness-map/harnessLayout';
import { nodeSize } from '../../src/utils/harnessLayout';
import {
	drawnEdges,
	focusView,
	nextNode,
	panView,
	zoomView
} from '../../src/components/explorer-ui/harness-map/focusView';
import { wholeView } from '../../src/utils/focusView';

function unit(id: string, dependencies: string[] = []): HarnessUnit {
	return {
		id,
		kind: 'function',
		status: 'active',
		title: id,
		responsibility: `Owns ${id}.`,
		dependencies: dependencies.map((target) => ({ unit: target, via: 'import' })),
		scenarios: [],
		owns: { source: [], symbols: [] },
		contract: { inputs: [], outputs: [], errors: [] },
		runtime: { kind: 'module', targets: [] },
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] },
		version: '0'.repeat(16)
	};
}
const name = (index: number) => `function.unit-${String(index).padStart(3, '0')}`;
/** Four hundred and eighty units in layers, each depending on two of the layer below. */
const many = Array.from({ length: 480 }, (_, index) =>
	unit(name(index), index < 120 ? [] : [name(index - 120), name(index - 119)])
);

test('a map of hundreds of units is a wide block, not a strip', () => {
	expect(mapColumns(11)).toBe(6);
	const layout = harnessLayout(many);
	expect(layout.nodes).toHaveLength(480);
	const whole = wholeView(layout);
	expect(whole.width / whole.height).toBeGreaterThan(0.9);
	expect(whole.width / whole.height).toBeLessThan(2.2);
	const positions = new Set(layout.nodes.map((node) => `${node.x}:${node.y}`));
	expect(positions.size).toBe(480);
});

test('focusing shows the wanted units at a readable size and leaves the rest of the map', () => {
	const layout = harnessLayout(many);
	const whole = wholeView(layout);
	const one = focusView(layout, new Set([name(300)]));
	const node = layout.nodes.find((item) => item.unit.id === name(300));
	expect(one.width).toBeLessThan(whole.width / 3);
	expect(one.x).toBeLessThan(node?.x ?? 0);
	expect(one.x + one.width).toBeGreaterThan((node?.x ?? 0) + nodeSize.width);
	expect(one.y).toBeLessThan(node?.y ?? 0);
	expect(one.y + one.height).toBeGreaterThan((node?.y ?? 0) + nodeSize.height);
	// At least about four nodes wide, so a single match keeps its surroundings and its label.
	expect(one.width).toBeGreaterThanOrEqual(4 * nodeSize.width);
	expect(focusView(layout, new Set())).toEqual(whole);
	expect(focusView(layout, new Set(many.map((item) => item.id)))).toEqual(whole);
});

test('zooming keeps the centre and stays within sensible limits; panning moves the view', () => {
	const whole = wholeView(harnessLayout(many));
	const closer = zoomView(whole, 2, whole);
	expect(closer.width).toBeCloseTo(whole.width / 2);
	expect(closer.x + closer.width / 2).toBeCloseTo(whole.x + whole.width / 2);
	let view = whole;
	for (let step = 0; step < 40; step += 1) view = zoomView(view, 2, whole);
	expect(view.width).toBeGreaterThanOrEqual(2 * nodeSize.width);
	for (let step = 0; step < 40; step += 1) view = zoomView(view, 0.5, whole);
	expect(view.width).toBeLessThanOrEqual(whole.width * 1.5);
	expect(panView(whole, 30, -10)).toEqual({ ...whole, x: whole.x + 30, y: whole.y - 10 });
});

test('a large map draws only the edges of the selected unit; a small one draws them all', () => {
	const layout = harnessLayout(many);
	expect(drawnEdges(layout, null)).toEqual([]);
	const chosen = drawnEdges(layout, name(300));
	expect(chosen.length).toBeGreaterThan(0);
	expect(chosen.every((edge) => edge.from === name(300) || edge.to === name(300))).toBe(true);
	const small = harnessLayout([unit('function.a', ['function.b']), unit('function.b')]);
	expect(drawnEdges(small, null)).toHaveLength(1);
});

test('arrow keys move between neighbouring units among those that are shown', () => {
	const layout = harnessLayout(many);
	const all = new Set(many.map((item) => item.id));
	const first = layout.nodes[0];
	const right = nextNode(layout, first.unit.id, 'ArrowRight', all);
	const second = layout.nodes.find((node) => node.unit.id === right);
	expect([second?.y, second?.x]).toEqual([first.y, first.x + nodeSize.width + nodeSize.gapX]);
	expect(nextNode(layout, right ?? '', 'ArrowLeft', all)).toBe(first.unit.id);
	const below = layout.nodes.find(
		(node) => node.unit.id === nextNode(layout, first.unit.id, 'ArrowDown', all)
	);
	expect(below?.x).toBe(first.x);
	expect(below?.y).toBeGreaterThan(first.y);
	expect(nextNode(layout, below?.unit.id ?? '', 'ArrowUp', all)).toBe(first.unit.id);
	// At an edge the focus stays where it is, and hidden units are skipped.
	expect(nextNode(layout, first.unit.id, 'ArrowLeft', all)).toBe(first.unit.id);
	const few = new Set([first.unit.id, name(7)]);
	expect(few.has(nextNode(layout, first.unit.id, 'ArrowRight', few) ?? '')).toBe(true);
	expect(nextNode(layout, first.unit.id, 'Enter', all)).toBeUndefined();
});
