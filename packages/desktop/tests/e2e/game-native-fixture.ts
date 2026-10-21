import { _electron, type Page } from '../../../../test/support/browserTest';
import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { nativeImageFixture } from './native-image-fixture';
const binary = createRequire(import.meta.url)('electron') as string;
const desktop = resolve(import.meta.dirname, '../..');
export async function capture(page: Page, state: string) {
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all([...document.images].map((image) => image.decode()));
	});
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
		env
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
	const cdp = await page.context().newCDPSession(page);
	const heap = await cdp.send('Runtime.getHeapUsage');
	await cdp.detach();
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
			elapsedMs: performance.now() - started,
			pageHeapBytes: heap.usedSize,
			memoryScope: 'Whole renderer V8 heap; excludes GPU and main process'
		}) + '\n'
	);
}
