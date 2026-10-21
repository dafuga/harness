import { expect, test } from 'vitest';
import { projectFiles } from '../src/templates/project';
import { evidenceRequested, recordCapture } from '../src/utils/record-capture/recordCapture';
import { machineProfile } from '../src/utils/machineProfile';
import { exampleDocument } from '../packages/game/src/utils/keyDoor';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

test.each(['2d', '3d'] as const)(
	'game project retains app scaffolds with %s engine',
	(dimension) => {
		const files = projectFiles({ kind: 'game', name: 'game-proof', dimension });
		const manifest = JSON.parse(files.find((f) => f.path === 'package.json')!.contents);
		expect(manifest.harness).toEqual({ kind: 'game', dimension, aiRendering: false });
		expect(files.some((f) => f.path === 'svelte.config.js')).toBe(true);
		expect(files.some((f) => f.path === 'src/routes/+page.svelte')).toBe(true);
		expect(files.find((f) => f.path === 'game.json')!.contents).toBe(
			JSON.stringify(exampleDocument(dimension), null, '\t') + '\n'
		);
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

test('game build scripts retain engine bytes and audit through the project CLI', async () => {
	const { gameSources } = await import('../src/templates/gameSources');
	const root = await mkdtemp(join(tmpdir(), 'harness-game-build-'));
	try {
		for (const [path, contents] of Object.entries(gameSources)) {
			const file = join(root, 'packages/game/src', path);
			await mkdir(dirname(file), { recursive: true });
			await writeFile(file, contents);
		}
		await mkdir(join(root, 'src/templates'), { recursive: true });
		observeScript(
			'script.sync-game-sources',
			['bun', resolve('scripts/sync-game-sources.ts')],
			root
		);
		const code = `import {pathToFileURL} from 'node:url'; const output=await import(pathToFileURL(process.argv[1]).href); console.log(JSON.stringify(output.gameSources));`;
		const output = execFileSync('bun', ['-e', code, join(root, 'src/templates/gameSources.ts')], {
			encoding: 'utf8'
		});
		expect(JSON.parse(output)).toEqual(gameSources);
		const audit = observeScript(
			'game.script.harness-audit',
			['bun', resolve('packages/game/scripts/harness-audit.ts')],
			resolve('packages/game')
		);
		expect(audit.stdout).toContain('Harness audit passed.');
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}, 30_000);

/** Run the actual build script; Bun's OS resource usage describes that launched process. */
function observeScript(unit: string, command: string[], cwd: string): { stdout: string } {
	const code = `
const {command,cwd}=JSON.parse(process.argv[1]);
const started=performance.now();
const result=Bun.spawnSync(command,{cwd,env:process.env,stdout:'pipe',stderr:'pipe'});
const elapsedMs=performance.now()-started;
if(result.exitCode!==0)throw new Error(result.stderr.toString());
console.log(JSON.stringify({elapsedMs,peakRssBytes:result.resourceUsage.maxRSS,stdout:result.stdout.toString()}));`;
	const output = JSON.parse(
		execFileSync('bun', ['-e', code, JSON.stringify({ command, cwd })], {
			encoding: 'utf8',
			env: { ...process.env, HARNESS_CLI_PATH: resolve('src/index.ts') }
		})
	);
	expect(output.elapsedMs).toBeGreaterThan(0);
	expect(output.peakRssBytes).toBeGreaterThan(0);
	if (evidenceRequested()) {
		const common = { unit, workload: unit + '.normal-script', target: 'process', samples: 1 };
		const measurements = [
			{
				...common,
				metric: 'script-wall-ms',
				unitOfMeasure: 'ms',
				value: output.elapsedMs,
				method:
					'Wall time from launching the normal script through exit, including Bun startup, I/O and delegated CLI work; excludes post-run assertions.'
			},
			{
				...common,
				metric: 'script-max-rss-bytes',
				unitOfMeasure: 'bytes',
				value: output.peakRssBytes,
				method:
					'Bun-reported maximum RSS of the launched script subprocess using OS child accounting; includes descendants only as aggregated by that OS. Excludes the test worker and renderer/GPU.'
			}
		];
		recordCapture(
			{
				evidence: 'game-build-workloads',
				kind: 'benchmark',
				state: unit,
				file: unit + '-runtime.json',
				mediaType: 'application/json'
			},
			JSON.stringify({ measurements })
		);
	}
	return output;
}
