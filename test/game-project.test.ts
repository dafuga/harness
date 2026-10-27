import { expect, test } from 'vitest';
import { projectFiles } from '../src/templates/projects-sessions/project';
import {
	evidenceRequested,
	recordCapture
} from '../src/utils/reports-media/record-capture/recordCapture';
import { machineProfile } from '../src/utils/development-tooling/machineProfile';
import { exampleDocument } from '../packages/game/src/utils/game-authoring/keyDoor';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { bunMaxRssBytes, gameCommand } from './support/gameCommand';

/** Bun 1.2.18 reports raw ru_maxrss: bytes on macOS, KiB on Linux and Windows. 50 MiB each. */
const maxRssUnits: [string, number, number][] = [
	['darwin', 52_428_800, 52_428_800],
	['linux', 51_200, 52_428_800],
	['win32', 51_200, 52_428_800]
];
/** A launched Bun runtime holds several MiB; a smaller figure means KiB were recorded as bytes. */
const minimumBunProcessBytes = 4 * 1024 * 1024;

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
	const { gameSources } = await import('../src/templates/game-authoring/gameSources');
	const { embeddedSource, gameSourceLayout } = await import('../scripts/sync-game-sources');
	/** Generated games keep their layout: only relative module specifiers and their wrapping differ. */
	const unbound = (text: string) => text.replace(/'\.{1,2}\/[^']+'/g, "''").replace(/\s+/g, '');
	expect(Object.keys(gameSources)).toEqual(Object.keys(gameSourceLayout));
	for (const [path, contents] of Object.entries(gameSources)) {
		const source = await readFile(
			new URL('../packages/game/src/' + gameSourceLayout[path], import.meta.url),
			'utf8'
		);
		expect(contents, path).toBe(await embeddedSource(path, source));
		expect(unbound(contents), path).toBe(unbound(source));
	}
});

test('game build scripts retain engine bytes and audit through the project CLI', async () => {
	const { gameSources } = await import('../src/templates/game-authoring/gameSources');
	const { gameSourceLayout } = await import('../scripts/sync-game-sources');
	const root = await mkdtemp(join(tmpdir(), 'harness-game-build-'));
	try {
		for (const path of Object.values(gameSourceLayout)) {
			const file = join(root, 'packages/game/src', path);
			await mkdir(dirname(file), { recursive: true });
			await writeFile(file, await readFile(resolve('packages/game/src', path), 'utf8'));
		}
		await mkdir(join(root, 'src/templates/game-authoring'), { recursive: true });
		const sync = observeScript(
			'script.sync-game-sources',
			['bun', resolve('scripts/sync-game-sources.ts')],
			root
		);
		const code = `import {pathToFileURL} from 'node:url'; const output=await import(pathToFileURL(process.argv[1]).href); console.log(JSON.stringify(output.gameSources));`;
		const output = execFileSync(
			'bun',
			['-e', code, join(root, 'src/templates/game-authoring/gameSources.ts')],
			{
				encoding: 'utf8'
			}
		);
		expect(JSON.parse(output)).toEqual(gameSources);
		const audit = observeScript(
			'game.script.harness-audit',
			['bun', resolve('packages/game/scripts/harness-audit.ts')],
			resolve('packages/game')
		);
		expect(audit.stdout).toContain('Harness audit passed.');
		const desktop = join(root, 'desktop');
		await mkdir(desktop);
		await symlink(resolve('packages/desktop/src'), join(desktop, 'src'), 'dir');
		const build = observeScript(
			'desktop.script.build-main',
			['bun', resolve('packages/desktop/scripts/build-main.ts')],
			desktop
		);
		assertAnalyticsBundle(desktop);
		for (const observed of [sync, audit, build])
			expect(observed.peakRssBytes).toBeGreaterThanOrEqual(minimumBunProcessBytes);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
	for (const [platform, reported, bytes] of maxRssUnits)
		expect(bunMaxRssBytes(reported, platform), platform).toBe(bytes);
	expect(() => bunMaxRssBytes(52_428_800, 'freebsd')).toThrow('not established for freebsd');
}, 30_000);

function assertAnalyticsBundle(desktop: string) {
	const build = `import {pathToFileURL} from 'node:url';
const {desktopNodeOptions}=await import(pathToFileURL(process.argv[1]).href);
const result=await Bun.build({...desktopNodeOptions,entrypoints:[process.argv[2]],outdir:process.argv[3],naming:'analytics.cjs'});
if(!result.success)throw new Error(result.logs.map(String).join(', '));`;
	const output = join(desktop, 'dist', 'analytics.cjs');
	execFileSync('bun', [
		'-e',
		build,
		resolve('packages/desktop/scripts/build-main.ts'),
		resolve('src/repositories/AnalyticsRepository.ts'),
		join(desktop, 'dist')
	]);
	const coldImport = `console.log(typeof require(process.argv[1]).AnalyticsRepository)`;
	expect(execFileSync('node', ['-e', coldImport, output], { encoding: 'utf8' }).trim()).toBe(
		'function'
	);
	const persist = `const {AnalyticsRepository}=require(process.argv[1]);
const event={id:'fixture',timestamp:'2026-10-27T00:00:00.000Z'};
let db=new AnalyticsRepository(process.argv[2]);db.record(event);db.close();
db=new AnalyticsRepository(process.argv[2]);console.log(db.events()[0].id);db.close();`;
	expect(
		execFileSync('bun', ['-e', persist, output, join(desktop, 'analytics')], {
			encoding: 'utf8'
		}).trim()
	).toBe('fixture');
}

/** Run the actual build script; Bun's OS resource usage describes that launched process. */
function observeScript(unit: string, command: string[], cwd: string) {
	return gameCommand(command, cwd, { units: [unit], workload: unit + '.normal-script' });
}
