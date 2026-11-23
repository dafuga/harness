import type { Run, View, Context, Drawn } from './game.function.software3d.test.types';
import { Software3dAdapter } from '../../src/adapters/game-authoring/Software3dAdapter';

export const COURTYARD = asView({
	id: 'courtyard',
	title: 'The courtyard',
	dimension: '2d',
	style: 'Lush illustrated garden, warm stone, soft sunlight.',
	checkpoints: []
});

export const GALLERY = asView({
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

function asView(value: unknown): View {
	return value as View;
}

export function asCanvas(value: unknown): HTMLCanvasElement {
	return value as HTMLCanvasElement;
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

export function makeCanvas(context: Context | null) {
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

export function summary(drawn: Drawn) {
	return {
		fills: drawn.context.fills,
		rects: drawn.context.rects,
		dataset: { ...drawn.canvas.dataset }
	};
}

export function meta(symbol: string, state: string) {
	return {
		unitId: 'game.function.software3d',
		symbol,
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}
