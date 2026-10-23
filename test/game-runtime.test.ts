import { expect, test, vi } from 'vitest';
import type * as Three from 'three';
const painted = vi.hoisted(() => vi.fn());
vi.mock('three', async (original) => ({
	...(await original<typeof Three>()),
	WebGLRenderer: class {
		setSize() {}
		setClearColor() {}
		render(...args: unknown[]) {
			painted(...args);
		}
		dispose() {}
	}
}));
import {
	create3d,
	createRun,
	stepGame,
	exampleDocument,
	validateDocument
} from '../packages/game/src/index';

test.each(['2d', '3d'] as const)(
	'%s key, door and branch share deterministic mechanics',
	(dimension) => {
		const view = exampleDocument(dimension).views[0];
		let run = createRun(7);
		const inputs = [
			{ x: 1, y: 0 },
			{ x: 1, y: 0 },
			{ x: 1, y: 0 },
			{ x: 1, y: 0 },
			{ x: 0, y: 0, choice: 'garden' }
		];
		for (const input of inputs) run = stepGame(run, input, view);
		expect(run.state.hasKey).toBe(true);
		expect(run.state.doorOpen).toBe(true);
		expect(run.state.outcome).toBe('garden');
		expect(run.completed).toEqual(['key', 'door', 'garden']);
		let replay = createRun(7);
		for (const input of inputs) replay = stepGame(replay, input, view);
		expect(replay).toEqual(run);
		expect(stepGame(run, { x: 0, y: 0 }, view).trace).toEqual(run.trace);
	}
);

test('checkpoint actions use a stable snapshot and cannot cascade within a tick', () => {
	const view = exampleDocument('2d').views[0];
	const run = stepGame(createRun(1), { x: 4, y: 0, choice: 'garden' }, view);
	expect(run.completed).toEqual(['key']);
	expect(run.state.doorOpen).toBe(false);
});

test('invalid references and unknown operations are rejected before execution', () => {
	const document = exampleDocument('2d');
	document.views[0].checkpoints[0].requires = ['missing'];
	expect(validateDocument(document)).toContain('Unknown checkpoint: missing');
	const malformed = JSON.parse(JSON.stringify(exampleDocument('2d')));
	malformed.views[0].checkpoints[0].actions[0].type = 'eval';
	expect(validateDocument(malformed).length).toBeGreaterThan(0);
});

test('native dimensions select real camera types while preserving engine objects', () => {
	const canvas = {
		width: 1280,
		height: 704,
		dataset: {},
		getContext: () => ({})
	} as unknown as HTMLCanvasElement;
	const source = create3d(canvas);
	const view = exampleDocument('2d').views[0];
	const run = createRun();
	source.render(run, view);
	const [world, flat] = painted.mock.lastCall!;
	expect(flat.isOrthographicCamera).toBe(true);
	const meshes: Three.Mesh[] = world.children.filter(
		(object: Three.Object3D) => object.type === 'Mesh'
	);
	const key = meshes.find((object) => object.position.x === 2)!;
	const door = meshes.find((object) => object.position.x === 4 && object.position.y === 1)!;
	const player = meshes.find(
		(object) => (object.geometry as Three.BoxGeometry).parameters.height === 0.8
	)!;
	const floor = world.getObjectByName('legacy-ground');
	expect(meshes).toHaveLength(4);
	expect(new Set([key, door, player, floor]).size).toBe(4);
	expect(meshes).toEqual(expect.arrayContaining([key, door, player, floor]));
	expect(meshes.every((object) => object.visible)).toBe(true);
	const groups: Three.Group[] = world.children.filter(
		(object: Three.Object3D) => object.type === 'Group'
	);
	expect(groups).toHaveLength(1);
	expect(groups[0].visible).toBe(false);
	expect(groups[0].children).toHaveLength(0);
	expect(
		world.children.filter((object: { visible: boolean }) => object.visible).length
	).toBeGreaterThan(3);
	const progressed = stepGame(run, { x: 2, y: 0 }, view);
	source.render(progressed, { ...view, dimension: '3d' });
	const [sameWorld, deep] = painted.mock.lastCall!;
	expect(sameWorld).toBe(world);
	expect(deep.isPerspectiveCamera).toBe(true);
	expect(progressed.state.hasKey).toBe(true);
	expect(world.children).toEqual(expect.arrayContaining([key, door, player, floor]));
	expect(meshes.filter((object) => !object.visible)).toEqual([key]);
	expect(player.position.toArray()).toEqual([progressed.state.x, 0.4, progressed.state.y]);
	expect(groups[0].visible).toBe(false);
	expect(canvas.dataset).toEqual({ renderer: 'webgl3d', dimension: '3d', ready: 'true' });
	source.dispose();
});
