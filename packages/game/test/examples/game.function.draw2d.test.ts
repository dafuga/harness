import { run } from './game.function.draw2d.fixture';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	Canvas2dAdapter,
	create2d,
	draw2d
} from '../../src/adapters/game-authoring/Canvas2dAdapter';
import { fakeCanvas, courtyard, texts, gardenLane, count } from './game.function.draw2d.fixtures';

const UNIT = 'game.function.draw2d';

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
