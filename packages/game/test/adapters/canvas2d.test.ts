import { expect, test, vi } from 'vitest';

test('public and owner 2D entries share one detachable frame source in a cold graph', async () => {
	vi.resetModules();
	const owner = await import('../../src/adapters/Canvas2dAdapter');
	const entry = await import('../../src/index');
	expect(entry.create2d).toBe(owner.create2d);
	expect(entry.draw2d).toBe(owner.draw2d);
	const cleared: number[][] = [];
	const canvas = {
		width: 4,
		height: 2,
		dataset: {},
		getContext: () => ({ clearRect: (...area: number[]) => cleared.push(area) })
	} as unknown as HTMLCanvasElement;
	const source = entry.create2d(canvas);
	expect(source).toBeInstanceOf(owner.Canvas2dAdapter);
	const { dispose } = source;
	dispose();
	expect(cleared).toEqual([[0, 0, 4, 2]]);
});
