import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import {
	create2d,
	create3d,
	createRun,
	draw2d,
	exampleDocument,
	stepGame,
	validateDocument
} from '../src/index';

/** A canvas whose 2D context records every call and property write in order. */
function recordingCanvas() {
	const calls: unknown[][] = [];
	const context = new Proxy(
		{},
		{
			get:
				(_target, key) =>
				(...args: unknown[]) =>
					void calls.push([String(key), ...args]),
			set: (_target, key, written) => calls.push(['=' + String(key), written]) > 0
		}
	);
	const canvas = {
		width: 1280,
		height: 704,
		dataset: {},
		getContext: (kind: string) => (kind === '2d' ? context : null)
	} as unknown as HTMLCanvasElement;
	return { canvas, calls };
}
const digest = (calls: unknown[][]) =>
	createHash('sha256').update(JSON.stringify(calls)).digest('hex');

test('public 2D renderers keep their canvas paint operations', () => {
	const view = exampleDocument('2d').views[0];
	const runs = [createRun(), stepGame(createRun(), { x: 2, y: 0 }, view)];
	const drawn = recordingCanvas();
	for (const run of runs) draw2d(drawn.canvas, run, view);
	expect(drawn.canvas.dataset).toEqual({ ready: 'true' });
	expect([drawn.calls.length, digest(drawn.calls)]).toEqual([
		189,
		'519bf3f99735dba6961051033648155536fc9faf543a2f3165349cafe27c4580'
	]);
	const created = recordingCanvas(),
		source = create2d(created.canvas);
	expect(source.canvas).toBe(created.canvas);
	for (const run of runs) source.render(run, view);
	source.dispose();
	expect(created.calls).toEqual([...drawn.calls, ['clearRect', 0, 0, 1280, 704]]);
});

test('public 3D renderer falls back to software canvas paint without WebGL', () => {
	const view = exampleDocument('3d').views[0];
	const { canvas, calls } = recordingCanvas();
	const source = create3d(canvas);
	expect(source.canvas).toBe(canvas);
	source.render(createRun(), view);
	source.render(stepGame(createRun(), { x: 2, y: 0 }, view), view);
	expect(canvas.dataset).toEqual({ ready: 'true', renderer: 'software3d' });
	source.dispose();
	expect(calls.at(-1)).toEqual(['clearRect', 0, 0, 1280, 704]);
	expect([calls.length, digest(calls)]).toEqual([
		175,
		'd1ec47ed2f06d612bf8ec9b07bdd16b271abadbe362290932ff7a7a754ee8c6a'
	]);
	const blank = { ...canvas, getContext: () => null } as unknown as HTMLCanvasElement;
	expect(() => create3d(blank)).toThrow('This browser cannot create a game canvas.');
});

test('both starter dimensions validate', () => {
	for (const d of ['2d', '3d'] as const) {
		const doc = exampleDocument(d);
		expect(validateDocument(doc)).toEqual([]);
		Object.assign(doc.views[0], { planning: { concept: '', description: '' } });
		expect(validateDocument(doc)).toEqual([]);
		Object.assign(doc.views[0], { planning: { concept: 42, description: '' } });
		expect(validateDocument(doc)).toContain('Invalid level planning');
	}
});

test('cyclic prerequisites cannot be saved as executable graphs', () => {
	const document = exampleDocument();
	document.views[0].checkpoints[0].requires = ['door'];
	expect(validateDocument(document)).toContain('Cyclic checkpoint prerequisites');
});

test('checkpoint image metadata accepts local immutable assets and rejects unsafe paths', () => {
	const doc = exampleDocument();
	doc.views[0].checkpoints[0].image = {
		path: 'static/game/checkpoints/' + 'a'.repeat(64) + '.png',
		model: 'gpt-image-2',
		prompt: 'A key',
		createdAt: '2026-10-20T00:00:00Z'
	};
	expect(validateDocument(doc)).toEqual([]);
	doc.views[0].checkpoints[0].image!.path = '../.env.local';
	expect(validateDocument(doc)).toContain('Invalid checkpoint');
});
