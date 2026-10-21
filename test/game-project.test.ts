import { expect, test } from 'vitest';
import { projectFiles } from '../src/templates/project';
import { evidenceRequested, recordCapture } from '../src/utils/record-capture/recordCapture';
import { machineProfile } from '../src/utils/machineProfile';

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
		observeFactory(dimension);
	}
);

function observeFactory(dimension: '2d' | '3d') {
	if (!evidenceRequested()) return;
	const timings: number[] = [];
	for (let index = 0; index < 200; index++) {
		const start = performance.now();
		projectFiles({ kind: 'game', name: 'game-proof', dimension });
		timings.push(performance.now() - start);
	}
	timings.sort((left, right) => left - right);
	const context = {
		unit: 'template.game-project',
		workload: `game-project-${dimension}-200`,
		target: 'module',
		samples: 200
	};
	const measurements = [
		{
			...context,
			metric: 'latency-warm-ms',
			unitOfMeasure: 'ms',
			value: timings[100],
			method: 'Median of 200 timed projectFiles calls producing the complete native game scaffold.'
		},
		{
			...context,
			metric: 'memory-bytes',
			unitOfMeasure: 'bytes',
			value: process.memoryUsage().rss,
			method: 'Whole Vitest Node process RSS after 200 scaffold plans; includes runner overhead.'
		}
	];
	recordCapture(
		{
			evidence: 'benchmark',
			kind: 'benchmark',
			state: dimension,
			file: `game-project-${dimension}-benchmark.json`,
			mediaType: 'application/json'
		},
		JSON.stringify({ profile: machineProfile().id, target: 'module', measurements })
	);
}

test('embedded engine sources match the reusable engine exactly', async () => {
	const { gameSources } = await import('../src/templates/gameSources');
	const { readFile } = await import('node:fs/promises');
	for (const [path, contents] of Object.entries(gameSources)) {
		expect(contents, path).toBe(
			await readFile(new URL('../packages/game/src/' + path, import.meta.url), 'utf8')
		);
	}
});
