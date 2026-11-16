import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { create3d } from '../../src/adapters/game-authoring/ThreeSceneAdapter';

function canvasFixture() {
	const dataset: Record<string, string> = {};
	const context = {
		fillRect() {},
		beginPath() {},
		moveTo() {},
		lineTo() {},
		closePath() {},
		fill() {},
		stroke() {},
		clearRect() {},
		fillStyle: '',
		strokeStyle: ''
	};
	const canvas = {
		width: 320,
		height: 200,
		dataset,
		getContext(kind: string) {
			return kind === '2d' ? context : null;
		}
	} as unknown as HTMLCanvasElement;
	return { canvas, dataset };
}

test('create3d uses software adapter when WebGL is unavailable', () => {
	const { canvas, dataset } = canvasFixture();
	const frame = create3d(canvas);
	const run = {
		tick: 8,
		seed: 123,
		state: { x: 2, y: 1, hasKey: false, doorOpen: false },
		completed: [],
		events: [],
		trace: []
	};
	const view = {
		id: 'view-forest-room',
		title: 'Forest Room',
		dimension: '3d' as const,
		style: 'adventure',
		checkpoints: []
	};
	frame.render(run, view);
	expect(dataset).toEqual({ ready: 'true', renderer: 'software3d' });
	frame.dispose();
	recordExampleCases(
		{
			unitId: 'game.function.create3d',
			symbol: 'create3d',
			state: 'create3d-uses-software-adapter-when-webgl-is-unavailable',
			evidence: 'examples-cases',
			file: 'create3d-uses-software-adapter-when-webgl-is-unavailable.json'
		},
		[
			{
				name: 'missing WebGL uses software rendering and marks the canvas ready',
				input: { width: 320, height: 200, run, view },
				output: { renderer: dataset.renderer, ready: dataset.ready }
			}
		]
	);
});
