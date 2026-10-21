import scenario from '../../../../specification/scenarios/game-authoring.json';
import { buildStamp } from '../../../../src/utils/buildStamp';
import { recordCapture } from '../../../../src/utils/record-capture/recordCapture';
import { _electron, type Page } from '../../../../test/support/browserTest';
import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { nativeImageFixture } from './native-image-fixture';
const binary = createRequire(import.meta.url)('electron') as string;
const desktop = resolve(import.meta.dirname, '../..');
export async function capture(page: Page, state: string) {
	if (process.env.TAKE_SCREENSHOT !== 'true' && !process.env.HARNESS_EVIDENCE_DIR) return;
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all([...document.images].map((image) => image.decode()));
	});
	await page.mouse.move(0, 0);
	if (process.env.HARNESS_EVIDENCE_DIR) {
		const size = page.viewportSize(),
			viewport = scenario.viewports.find(
				(v) => v.width === size?.width && v.height === size?.height
			)?.id;
		const buildId = buildStamp(
			(await page.locator('meta[name="harness-build"]').getAttribute('content')) ?? undefined
		);
		const revision = process.env.HARNESS_VERIFY_REVISION;
		if (!viewport || !scenario.states.some((s) => s.id === state) || !buildId || !revision)
			throw new Error(
				'Game evidence needs a declared state, viewport and compiled build identity.'
			);
		recordCapture(
			{
				evidence: 'game-native-screens',
				kind: 'screenshot',
				state,
				viewport,
				file: `game-native-${state}-${viewport}.png`,
				mediaType: 'image/png',
				provenance: 'actual-capture',
				server: { buildId, revision },
				note: 'Real compiled Electron renderer and IPC; controlled GPT Image response in a disposable project; no live provider request.'
			},
			await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' })
		);
	}
	if (process.env.TAKE_SCREENSHOT === 'true')
		await page.screenshot({
			path: `test-results/game-native-${state}-${page.viewportSize()?.width}.png`,
			fullPage: true
		});
}
export async function launch(profile: string) {
	const entry = join(profile, 'acceptance.cjs');
	const png = Buffer.from(nativeImageFixture()).toString('base64');
	await writeFile(
		entry,
		`
 const { app } = require('electron');
 app.setAppPath(${JSON.stringify(desktop)});
 const original = globalThis.fetch;
 globalThis.fetch = async (input, options) => {
  if (String(input) !== 'https://api.openai.com/v1/images/generations') return original(input, options);
  const body = JSON.parse(String(options?.body));
  if (body.model !== 'gpt-image-2' || !body.prompt.includes('Consequences:')) throw new Error('Incorrect image request');
  return new Response(JSON.stringify({ data: [{ b64_json: ${JSON.stringify(png)} }] }));
 };
 require(${JSON.stringify(join(desktop, 'dist/main.cjs'))});
 `
	);
	const env = Object.fromEntries(
		Object.entries(process.env).filter(
			([name, value]) => name !== 'ELECTRON_RUN_AS_NODE' && value !== undefined
		)
	) as Record<string, string>;
	return _electron.launch({
		executablePath: binary,
		args: [entry, `--user-data-dir=${profile}`],
		env: {
			...env,
			GIT_AUTHOR_NAME: 'Harness Test',
			GIT_AUTHOR_EMAIL: 'harness-test@example.invalid',
			GIT_COMMITTER_NAME: 'Harness Test',
			GIT_COMMITTER_EMAIL: 'harness-test@example.invalid'
		}
	});
}
export async function imageProvider(root: string) {
	await appendFile(join(root, '.gitignore'), '\n.env.local\n');
	await writeFile(
		join(root, '.env.local'),
		'HARNESS_GAME_OPENAI_API_KEY=synthetic-game-test-key\n',
		{ mode: 0o600 }
	);
}

export async function recordRuntime(page: Page, started: number, dimension: string) {
	const elapsedMs = performance.now() - started;
	const cdp = await page.context().newCDPSession(page);
	const heap = await cdp.send('Runtime.getHeapUsage');
	await cdp.detach();
	const viewport = scenario.viewports.find((v) => v.width === page.viewportSize()?.width)?.id;
	if (viewport) recordGameRuntime({ dimension, viewport, elapsedMs, heap: heap.usedSize });
	const directory = resolve(desktop, '../../.cache/game-authoring-evidence');
	await mkdir(directory, { recursive: true });
	await appendFile(
		join(directory, 'runtime.ndjson'),
		JSON.stringify({
			revision:
				process.env.HARNESS_VERIFY_REVISION ??
				execFileSync('git', ['rev-parse', 'HEAD'], {
					cwd: desktop,
					encoding: 'utf8'
				}).trim(),
			dimension,
			viewport: page.viewportSize(),
			workload: 'Native page reload to saved game and ready canvas',
			elapsedMs,
			pageHeapBytes: heap.usedSize,
			memoryScope: 'Whole renderer V8 heap; excludes GPU and main process'
		}) + '\n'
	);
}

function recordGameRuntime({
	dimension,
	viewport,
	elapsedMs,
	heap
}: {
	dimension: string;
	viewport: string;
	elapsedMs: number;
	heap: number;
}) {
	if (process.env.HARNESS_EVIDENCE_DIR)
		recordCapture(
			{
				evidence: 'game-native-runtime',
				kind: 'benchmark',
				state: dimension + '-reopened',
				viewport,
				file: `game-native-runtime-${dimension}-${viewport}.json`,
				mediaType: 'application/json'
			},
			JSON.stringify({
				measurements: [
					{
						unit: 'desktop.page.game',
						metric: 'native-page-ready-ms',
						unitOfMeasure: 'ms',
						value: elapsedMs,
						workload: `saved-${dimension}-${viewport}`,
						target: 'process',
						samples: 1,
						method:
							'Wall time from reload through saved game and ready canvas, including Electron IPC and shared code; not isolated component timing.'
					},
					{
						unit: 'desktop.page.game',
						metric: 'renderer-js-heap-bytes',
						unitOfMeasure: 'bytes',
						value: heap,
						workload: `saved-${dimension}-${viewport}`,
						target: 'process',
						samples: 1,
						method:
							'Chromium Runtime.getHeapUsage after the ready canvas; whole renderer JavaScript heap, excluding GPU and main process, not isolated component memory.'
					}
				]
			})
		);
}
