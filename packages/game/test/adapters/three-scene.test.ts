import { expect, test, vi } from 'vitest';
import type * as Three from 'three';
const disposed = vi.hoisted(() => vi.fn());
vi.mock('three', async (original) => ({
	...(await original<typeof Three>()),
	WebGLRenderer: class {
		setSize() {}
		setClearColor() {}
		render() {}
		dispose = disposed;
	}
}));

test('public create3d selects the owner Three.js source when WebGL2 exists', async () => {
	vi.resetModules();
	const owner = await import('../../src/adapters/game-authoring/ThreeSceneAdapter');
	const entry = await import('../../src/index');
	expect(entry.create3d).toBe(owner.create3d);
	const canvas = { width: 1280, height: 704, dataset: {}, getContext: () => ({}) };
	const source = entry.create3d(canvas as unknown as HTMLCanvasElement);
	expect(source).toBeInstanceOf(owner.ThreeSceneAdapter);
	expect(canvas.dataset).toEqual({ renderer: 'webgl3d' });
	const { dispose } = source;
	dispose();
	expect(disposed).toHaveBeenCalledTimes(1);
});
