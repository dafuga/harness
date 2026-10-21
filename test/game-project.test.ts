import { expect, test } from 'vitest';
import { projectFiles } from '../src/templates/project';

test.each(['2d', '3d'] as const)(
	'game project retains app scaffolds with %s engine',
	(dimension) => {
		const files = projectFiles({ kind: 'game', name: 'game-proof', dimension });
		const manifest = JSON.parse(files.find((f) => f.path === 'package.json')!.contents);
		expect(manifest.harness).toEqual({ kind: 'game', dimension, aiRendering: false });
		expect(files.some((f) => f.path === 'svelte.config.js')).toBe(true);
		expect(files.some((f) => f.path === 'src/routes/+page.svelte')).toBe(true);
		expect(files.some((f) => f.path === 'game.json')).toBe(true);
		expect(files.some((f) => f.path === 'src/lib/game/utils/gameStep.ts')).toBe(true);
		const page = files.find((f) => f.path === 'src/routes/game/+page.svelte')!.contents;
		expect(page).toContain('create3d');
		expect(page).not.toContain('draw2d');
		expect(page).not.toContain('startRender');
		expect(files.some((f) => f.path === 'static/game/assets/README.md')).toBe(true);
	}
);

test('embedded engine sources match the reusable engine exactly', async () => {
	const { gameSources } = await import('../src/templates/gameSources');
	const { readFile } = await import('node:fs/promises');
	for (const [path, contents] of Object.entries(gameSources)) {
		expect(contents, path).toBe(
			await readFile(new URL('../packages/game/src/' + path, import.meta.url), 'utf8')
		);
	}
});
