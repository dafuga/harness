import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	mapColumns,
	harnessLayout
} from '../../src/components/explorer-ui/harness-map/harnessLayout';
import { nodeSize } from '../../src/utils/explorer-ui/harnessLayout';
import type { HarnessLayout } from '../../src/utils/explorer-ui/harnessLayout.types';
import type { Unit } from './reports.function.harness-layout.test.types';

const unitId = 'reports.function.harness-layout';

function unit(id: string, dependencies: string[] = []): Unit {
	return {
		id,
		dependencies: dependencies.map((target) => ({ unit: target, via: 'import' }))
	} as unknown as Unit;
}

function summarise(layout: HarnessLayout) {
	return {
		nodes: layout.nodes.map((node) => ({ id: node.unit.id, x: node.x, y: node.y })),
		edges: layout.edges,
		width: layout.width,
		height: layout.height
	};
}

test('Lays out an empty map at the node size', () => {
	const output = { nodes: [], edges: [], width: 176, height: 34 };
	expect(nodeSize).toEqual({ width: 176, height: 34, gapX: 16, gapY: 46 });
	expect(summarise(harnessLayout([]))).toEqual(output);
	recordExampleCases(
		{
			unitId,
			symbol: 'harnessLayout',
			state: 'lays-out-an-empty-map-at-the-node-size',
			evidence: 'examples-cases',
			file: 'lays-out-an-empty-map-at-the-node-size.json'
		},
		[{ name: 'no units to place', input: [], output }]
	);
});

test('Sizes map rows from the unit count', () => {
	const pairs: Array<[number, number]> = [
		[0, 6],
		[36, 6],
		[240, 14],
		[412, 18]
	];
	expect(pairs.map(([count]) => mapColumns(count))).toEqual([6, 6, 14, 18]);
	recordExampleCases(
		{
			unitId,
			symbol: 'mapColumns',
			state: 'sizes-map-rows-from-the-unit-count',
			evidence: 'examples-cases',
			file: 'sizes-map-rows-from-the-unit-count.json'
		},
		pairs.map(([input, output]) => ({ name: `${input} units`, input, output }))
	);
});

test('Places dependencies in layers with deduplicated edges', () => {
	const units = [unit('a', ['b', 'x']), unit('b'), unit('c', ['a', 'b', 'b'])];
	const output = {
		nodes: [
			{ id: 'c', x: 0, y: 0 },
			{ id: 'a', x: 0, y: 80 },
			{ id: 'b', x: 0, y: 160 }
		],
		edges: [
			{ from: 'a', to: 'b', x1: 88, y1: 114, x2: 88, y2: 160 },
			{ from: 'c', to: 'a', x1: 88, y1: 34, x2: 88, y2: 80 },
			{ from: 'c', to: 'b', x1: 88, y1: 34, x2: 88, y2: 160 }
		],
		width: 176,
		height: 194
	};
	expect(summarise(harnessLayout(units))).toEqual(output);
	recordExampleCases(
		{
			unitId,
			symbol: 'harnessLayout',
			state: 'places-dependencies-in-layers-with-deduplicated-edges',
			evidence: 'examples-cases',
			file: 'places-dependencies-in-layers-with-deduplicated-edges.json'
		},
		[
			{
				name: 'chain a to b, c to a and b, with a repeated and an unknown dependency ignored',
				input: units,
				output
			}
		]
	);
});

test('Wraps wide layers into rows of perRow units', () => {
	const units = ['e', 'b', 'd', 'a', 'c'].map((id) => unit(id));
	const output = {
		nodes: [
			{ id: 'a', x: 0, y: 0 },
			{ id: 'b', x: 192, y: 0 },
			{ id: 'c', x: 0, y: 80 },
			{ id: 'd', x: 192, y: 80 },
			{ id: 'e', x: 0, y: 160 }
		],
		edges: [],
		width: 368,
		height: 194
	};
	expect(summarise(harnessLayout(units, 2))).toEqual(output);
	recordExampleCases(
		{
			unitId,
			symbol: 'harnessLayout',
			state: 'wraps-wide-layers-into-rows-of-perrow-units',
			evidence: 'examples-cases',
			file: 'wraps-wide-layers-into-rows-of-perrow-units.json'
		},
		[{ name: 'five independent units with perRow 2', input: { units, perRow: 2 }, output }]
	);
});
