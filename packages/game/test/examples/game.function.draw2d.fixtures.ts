import type { View, Call } from './game.function.draw2d.test.types';

export const courtyard = {
	id: 'courtyard',
	title: 'The courtyard',
	dimension: '2d',
	style: 'Lush illustrated garden, warm stone, soft sunlight.',
	checkpoints: []
} as unknown as View;

export const gardenLane = {
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

export function fakeCanvas(width: number, height: number, hasContext = true) {
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

export function count(calls: Call[], name: string): number {
	return calls.filter((call) => call.method === name).length;
}

export function texts(calls: Call[]): unknown[] {
	return calls.filter((call) => call.method === 'fillText').map((call) => call.args[0]);
}
