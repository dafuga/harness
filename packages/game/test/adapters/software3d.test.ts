import { expect, test, vi } from 'vitest';

test('public create3d falls back to the owner software source without WebGL2', async () => {
	vi.resetModules();
	const { Software3dAdapter } = await import('../../src/adapters/Software3dAdapter');
	const { create3d } = await import('../../src/index');
	const blank = { width: 4, height: 2, dataset: {}, getContext: () => null };
	expect(() => new Software3dAdapter(blank as unknown as HTMLCanvasElement)).toThrow(
		'This browser cannot create a game canvas.'
	);
	const cleared: number[][] = [];
	const context = { clearRect: (...area: number[]) => cleared.push(area) };
	const canvas = { ...blank, getContext: (kind: string) => (kind === '2d' ? context : null) };
	const source = create3d(canvas as unknown as HTMLCanvasElement);
	expect(source).toBeInstanceOf(Software3dAdapter);
	const { dispose } = source;
	dispose();
	expect(cleared).toEqual([[0, 0, 4, 2]]);
});
