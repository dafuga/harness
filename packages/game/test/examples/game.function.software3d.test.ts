import type { Run, View, Context, Drawn } from './game.function.software3d.test.types';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { Canvas2dContextUnavailableError } from '../../src/adapters/game-authoring/Canvas2dContextUnavailableError';
import { Software3dAdapter } from '../../src/adapters/game-authoring/Software3dAdapter';

const KEY_HELD = { x: 2, y: 0, hasKey: true, doorOpen: false };
const KEY_LOOSE = { x: 1.5, y: 4.5, hasKey: false, doorOpen: false };
const COURTYARD = asView({
	id: 'courtyard',
	title: 'The courtyard',
	dimension: '2d',
	style: 'Lush illustrated garden, warm stone, soft sunlight.',
	checkpoints: []
});
const GALLERY = asView({
	id: 'gallery',
	title: 'Stone gallery',
	dimension: '3d',
	style: 'Quiet stone gallery with cool daylight from high windows.',
	checkpoints: [],
	world: {
		width: 12,
		depth: 9,
		spawn: { x: 1.5, z: 4.5 },
		objects: [
			{
				id: 'north-wall',
				kind: 'wall',
				label: 'North wall',
				x: 6,
				z: 0.5,
				width: 12,
				depth: 1,
				height: 3
			},
			{
				id: 'exit-gate',
				kind: 'goal',
				label: 'Exit gate',
				x: 10.5,
				z: 4.5,
				width: 1,
				depth: 2,
				height: 1.2
			}
		]
	}
});

function asRun(value: unknown): Run {
	return value as Run;
}

function asView(value: unknown): View {
	return value as View;
}

function asCanvas(value: unknown): HTMLCanvasElement {
	return value as HTMLCanvasElement;
}

function runWith(state: Record<string, unknown>): Run {
	return asRun({
		viewId: 'courtyard',
		tick: 42,
		seed: 2846521197,
		state,
		completed: [],
		events: [],
		trace: []
	});
}

/** A fake 2D context that records fills, background rectangles and clears. */
export function makeContext() {
	return {
		fillStyle: '',
		strokeStyle: '',
		fills: [] as string[],
		rects: [] as number[][],
		clears: [] as number[][],
		beginPath: () => undefined,
		moveTo: () => undefined,
		lineTo: () => undefined,
		closePath: () => undefined,
		stroke: () => undefined,
		fill(this: { fills: string[]; fillStyle: string }) {
			this.fills.push(this.fillStyle);
		},
		fillRect(this: { rects: number[][] }, ...args: number[]) {
			this.rects.push(args);
		},
		clearRect(this: { clears: number[][] }, ...args: number[]) {
			this.clears.push(args);
		}
	};
}

function makeCanvas(context: Context | null) {
	return {
		width: 320,
		height: 200,
		dataset: {} as Record<string, string>,
		getContext: () => context
	};
}

export function drawWith(run: Run, view: View) {
	const context = makeContext();
	const canvas = makeCanvas(context);
	new Software3dAdapter(asCanvas(canvas)).render(run, view);
	return { canvas, context };
}

function summary(drawn: Drawn) {
	return {
		fills: drawn.context.fills,
		rects: drawn.context.rects,
		dataset: { ...drawn.canvas.dataset }
	};
}

function meta(symbol: string, state: string) {
	return {
		unitId: 'game.function.software3d',
		symbol,
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

test('Throws when the canvas has no 2D context', () => {
	const input = { width: 320, height: 200, context: null };
	expect(() => new Software3dAdapter(asCanvas(makeCanvas(null)))).toThrow(
		Canvas2dContextUnavailableError
	);
	expect(() => new Software3dAdapter(asCanvas(makeCanvas(null)))).toThrow(
		'This browser cannot create a game canvas.'
	);
	recordExampleCases(
		meta('Software3dAdapter.constructor', 'throws-when-the-canvas-has-no-2d-context'),
		[
			{
				name: 'canvas without a 2d context is rejected',
				input,
				error: 'This browser cannot create a game canvas.'
			}
		]
	);
});

test('Paints the built-in scene with a key and a door', () => {
	const held = drawWith(runWith(KEY_HELD), COURTYARD);
	const loose = drawWith(runWith(KEY_LOOSE), COURTYARD);
	expect(held.context.rects[0]).toEqual([0, 0, 320, 200]);
	expect(held.context.fills).toContain('#c7995d');
	expect(held.context.fills).not.toContain('#f5d77d');
	expect(loose.context.fills).toContain('#f5d77d');
	expect(held.canvas.dataset).toEqual({ ready: 'true', renderer: 'software3d' });
	recordExampleCases(
		meta('Software3dAdapter.render', 'paints-the-built-in-scene-with-a-key-and-a-door'),
		[
			{
				name: 'key already held: door drawn, key hidden',
				input: { state: KEY_HELD },
				output: summary(held)
			},
			{ name: 'key on the floor: key drawn', input: { state: KEY_LOOSE }, output: summary(loose) }
		]
	);
});

test('Renders a level world and marks the canvas as 3d', () => {
	const drawn = drawWith(runWith(KEY_LOOSE), GALLERY);
	expect(drawn.canvas.dataset).toEqual({ ready: 'true', renderer: 'software3d', dimension: '3d' });
	expect(drawn.context.fills).toContain('#c7995d');
	expect(drawn.context.fills).toContain('#f5d77d');
	expect(drawn.context.fills).toContain('#acd8ee');
	recordExampleCases(
		meta('Software3dAdapter.render', 'renders-a-level-world-and-marks-the-canvas-as-3d'),
		[
			{
				name: 'gallery world draws walls, exit gate and player',
				input: { state: KEY_LOOSE, view: 'gallery' },
				output: summary(drawn)
			}
		]
	);
});

test('Hides boxes whose visible flag is exactly false', () => {
	const state = {
		x: 2,
		y: 0,
		hasKey: false,
		doorOpen: false,
		'visible:door': false,
		'visible:player': false,
		'visible:key': 0
	};
	const drawn = drawWith(runWith(state), COURTYARD);
	expect(drawn.context.fills).not.toContain('#c7995d');
	expect(drawn.context.fills).not.toContain('#acd8ee');
	expect(drawn.context.fills).toContain('#f5d77d');
	recordExampleCases(
		meta('Software3dAdapter.render', 'hides-boxes-whose-visible-flag-is-exactly-false'),
		[
			{
				name: 'door and player hidden by false flags, key kept because 0 is not false',
				input: { state },
				output: summary(drawn)
			}
		]
	);
});

test('Dispose clears the canvas and allows another render', () => {
	const context = makeContext();
	const canvas = makeCanvas(context);
	const adapter = new Software3dAdapter(asCanvas(canvas));
	adapter.render(runWith(KEY_LOOSE), COURTYARD);
	const fillsBefore = context.fills.length;
	adapter.dispose();
	expect(context.clears).toEqual([[0, 0, 320, 200]]);
	adapter.render(runWith(KEY_HELD), COURTYARD);
	expect(context.fills.length).toBeGreaterThan(fillsBefore);
	expect(canvas.dataset.ready).toBe('true');
	recordExampleCases(
		meta('Software3dAdapter.dispose', 'dispose-clears-the-canvas-and-allows-another-render'),
		[
			{
				name: 'dispose clears the full canvas, then render draws again',
				input: { width: 320, height: 200 },
				output: { clears: context.clears, ready: canvas.dataset.ready, redrawn: true }
			}
		]
	);
});
