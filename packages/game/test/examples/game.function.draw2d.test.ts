import { run } from './game.function.draw2d.fixture';
import type { View, Call } from './game.function.draw2d.test.types';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	Canvas2dAdapter,
	create2d,
	draw2d
} from '../../src/adapters/game-authoring/Canvas2dAdapter';

const UNIT = 'game.function.draw2d';

const courtyard = {
	id: 'courtyard',
	title: 'The courtyard',
	dimension: '2d',
	style: 'Lush illustrated garden, warm stone, soft sunlight.',
	checkpoints: []
} as unknown as View;

const gardenLane = {
	id: 'garden-lane',
	title: 'Garden lane',
	dimension: '2d',
	style: 'Top-down floor plan with a green lawn and pale stone walls.',
	checkpoints: [],
	world: {
		width: 12,
		depth: 8,
		spawn: { x: 1.5, z: 4 },
		objects: [
			{
				id: 'north-wall',
				kind: 'wall',
				label: 'North wall',
				x: 6,
				z: 0.5,
				width: 12,
				depth: 1,
				height: 2.5
			},
			{
				id: 'south-wall',
				kind: 'wall',
				label: 'South wall',
				x: 6,
				z: 7.5,
				width: 12,
				depth: 1,
				height: 2.5
			},
			{
				id: 'gate-pad',
				kind: 'goal',
				label: 'Gate pad',
				x: 10,
				z: 4,
				width: 1.5,
				depth: 1.5,
				height: 1
			}
		]
	}
} as unknown as View;

function fakeCanvas(width: number, height: number, hasContext = true) {
	const calls: Call[] = [];
	const method =
		(name: string) =>
		(...args: unknown[]) => {
			calls.push({ method: name, args });
		};
	const ctx = {
		fillStyle: '',
		strokeStyle: '',
		font: '',
		fillRect: method('fillRect'),
		clearRect: method('clearRect'),
		beginPath: method('beginPath'),
		moveTo: method('moveTo'),
		lineTo: method('lineTo'),
		stroke: method('stroke'),
		arc: method('arc'),
		fill: method('fill'),
		fillText: method('fillText')
	};
	const dataset: Record<string, string> = {};
	const element = {
		width,
		height,
		dataset,
		getContext: () => (hasContext ? ctx : null)
	} as unknown as HTMLCanvasElement;
	return { element, calls, dataset };
}

function count(calls: Call[], name: string): number {
	return calls.filter((call) => call.method === name).length;
}

function texts(calls: Call[]): unknown[] {
	return calls.filter((call) => call.method === 'fillText').map((call) => call.args[0]);
}

test('Draws the default scene with the view title', () => {
	const { element, calls, dataset } = fakeCanvas(240, 160);
	const state = { x: 2, y: 0, hasKey: false, doorOpen: false };
	const output = draw2d(element, run(state), courtyard);
	expect(output).toBeUndefined();
	expect(texts(calls)).toEqual(['The courtyard']);
	expect(dataset).toEqual({ ready: 'true' });
	recordExampleCases(
		{
			unitId: UNIT,
			symbol: 'draw2d',
			state: 'draws-the-default-scene-with-the-view-title',
			evidence: 'examples-cases',
			file: 'draws-the-default-scene-with-the-view-title.json'
		},
		[
			{
				name: 'courtyard without a world draws its title and marks the canvas ready',
				input: { width: 240, height: 160, viewId: courtyard.id, state },
				output: { ready: dataset.ready, texts: texts(calls) }
			}
		]
	);
});

test('Draws the garden lane world as a floor with objects', () => {
	const { element, calls, dataset } = fakeCanvas(240, 160);
	const state = { x: 1.5, y: 4 };
	draw2d(element, run(state), gardenLane);
	expect(dataset).toEqual({ ready: 'true', dimension: '2d' });
	expect(texts(calls)).toEqual([]);
	expect(count(calls, 'fillRect')).toBe(6);
	recordExampleCases(
		{
			unitId: UNIT,
			symbol: 'draw2d',
			state: 'draws-the-garden-lane-world-as-a-floor-with-objects',
			evidence: 'examples-cases',
			file: 'draws-the-garden-lane-world-as-a-floor-with-objects.json'
		},
		[
			{
				name: 'world view replaces the title with floor, three objects and the player',
				input: { width: 240, height: 160, viewId: gardenLane.id, state },
				output: {
					dimension: dataset.dimension,
					fillRects: count(calls, 'fillRect'),
					texts: texts(calls)
				}
			}
		]
	);
});

test('Hides the door, key and player when their flags are false', () => {
	const { element, calls } = fakeCanvas(240, 160);
	const state = {
		x: 2,
		y: 0,
		hasKey: false,
		doorOpen: false,
		'visible:door': false,
		'visible:key': false,
		'visible:player': false
	};
	draw2d(element, run(state), courtyard);
	expect(count(calls, 'arc')).toBe(0);
	expect(count(calls, 'fillRect')).toBe(2);
	recordExampleCases(
		{
			unitId: UNIT,
			symbol: 'draw2d',
			state: 'hides-the-door-key-and-player-when-their-flags-are-false',
			evidence: 'examples-cases',
			file: 'hides-the-door-key-and-player-when-their-flags-are-false.json'
		},
		[
			{
				name: 'exact false visibility flags leave only the background and floor',
				input: { width: 240, height: 160, viewId: courtyard.id, state },
				output: { arcs: count(calls, 'arc'), fillRects: count(calls, 'fillRect') }
			}
		]
	);
});

test('Render paints a frame and dispose clears the canvas', () => {
	const { element, calls } = fakeCanvas(240, 160);
	const adapter = new Canvas2dAdapter(element);
	const frame = adapter.render(run({ x: 2, y: 0, hasKey: true }), courtyard);
	expect(frame).toBeUndefined();
	expect(texts(calls)).toEqual(['The courtyard']);
	expect(adapter.canvas).toBe(element);
	const cleared = adapter.dispose();
	expect(cleared).toBeUndefined();
	expect(calls[calls.length - 1]).toEqual({ method: 'clearRect', args: [0, 0, 240, 160] });
	recordExampleCases(
		{
			unitId: UNIT,
			symbol: 'Canvas2dAdapter.render',
			state: 'render-paints-a-frame-and-dispose-clears-the-canvas',
			evidence: 'examples-cases',
			file: 'render-paints-a-frame-and-dispose-clears-the-canvas.json'
		},
		[
			{
				name: 'render paints the courtyard frame and dispose clears the full canvas',
				input: { width: 240, height: 160, viewId: courtyard.id, hasKey: true },
				output: { texts: texts(calls), lastCall: calls[calls.length - 1] }
			}
		]
	);
});

test('Skips drawing when the canvas has no 2d context', () => {
	const { element, calls, dataset } = fakeCanvas(240, 160, false);
	draw2d(element, run({ x: 2, y: 0 }), courtyard);
	create2d(element).dispose();
	expect(calls).toEqual([]);
	expect(dataset).toEqual({});
	recordExampleCases(
		{
			unitId: UNIT,
			symbol: 'draw2d',
			state: 'skips-drawing-when-the-canvas-has-no-2d-context',
			evidence: 'examples-cases',
			file: 'skips-drawing-when-the-canvas-has-no-2d-context.json'
		},
		[
			{
				name: 'missing 2d context leaves the canvas untouched for draw and dispose',
				input: { width: 240, height: 160, context: null, viewId: courtyard.id },
				output: { calls: calls.length, dataset: { ...dataset } }
			}
		]
	);
});
