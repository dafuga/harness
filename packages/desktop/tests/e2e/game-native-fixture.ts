import { prepareNativeLegacyGame } from './native-level-fixture';
import { viewSettings, doneCheckpoint } from './game-unsaved-fixture';
import scenario from '../../../../specification/scenarios/game-authoring.json' with { type: 'json' };
import { buildStamp } from '../../../../src/utils/development-tooling/buildStamp';
import { recordCapture } from '../../../../src/utils/reports-media/record-capture/recordCapture';
import {
	_electron,
	expect,
	type Page,
	type ElectronApplication
} from '../../../../test/support/browserTest';
import { writeFile, appendFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve, basename } from 'node:path';
import { mkdirSync, appendFileSync } from 'node:fs';
import { nativeImageFixture } from './native-image-fixture';
import { recordGameState } from './game-runtime-fixture';
const binary = createRequire(import.meta.url)('electron') as string;
const desktop = resolve(import.meta.dirname, '../..');
/** All catalog controls keep their own hit area before reopening the saved current game. */
export async function catalogNavigation(page: Page) {
	const game = page.getByRole('link', { name: 'Game Views', exact: true });
	for (const control of [
		page.getByRole('button', { name: 'Search entities', exact: true }),
		page.getByRole('link', { name: 'Settings', exact: true })
	]) {
		const [tab, tool] = await Promise.all([game.boundingBox(), control.boundingBox()]);
		expect(tab).not.toBeNull();
		expect(tool).not.toBeNull();
		const separate =
			tab!.x + tab!.width <= tool!.x ||
			tool!.x + tool!.width <= tab!.x ||
			tab!.y + tab!.height <= tool!.y ||
			tool!.y + tool!.height <= tab!.y;
		expect(separate, 'Game Views must not overlap catalog search or settings').toBe(true);
	}
	await page.getByRole('button', { name: 'Search entities', exact: true }).click();
	const search = page.getByRole('dialog', { name: 'Search project', exact: true });
	await expect(search).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(search).not.toBeVisible();
	await game.click();
	await expect(page.getByRole('heading', { name: 'Game Views', exact: true })).toBeVisible();
	await expect(page.getByLabel('View title', { exact: true })).toHaveValue('Authored courtyard');
	await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
}
/**
 * Fit View shows every checkpoint at each canvas width from the declared viewport down to a classic
 * 15 px scrollbar gutter narrower, then fits the declared size again.
 */
export async function fitEveryCheckpoint(page: Page, checkpoints: number) {
	const viewport = page.viewportSize()!;
	const fit = page.getByRole('button', { name: 'Fit View', exact: true });
	const nodes = page
		.getByRole('region', { name: 'Checkpoint graph', exact: true })
		.locator('[aria-roledescription="node"]');
	for (let gutter = 0; gutter <= 15; gutter++) {
		await page.setViewportSize({ width: viewport.width - gutter, height: viewport.height });
		await fit.click();
		await expect(nodes).toHaveCount(checkpoints);
		for (const node of await nodes.all())
			await expect(
				node,
				`Fit View must show every checkpoint ${gutter} px narrower`
			).toBeInViewport({ ratio: 1 });
	}
	await page.setViewportSize(viewport);
	await fit.click();
}
export async function capture(page: Page, state: string) {
	if (process.env.TAKE_SCREENSHOT !== 'true' && !process.env.HARNESS_EVIDENCE_DIR) return;
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all([...document.images].map((image) => image.decode()));
	});
	await recordGameState(page, state);
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
	const app = await _electron.launch({
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
	watchHost(app, profile);
	return app;
}
export async function imageProvider(root: string) {
	await appendFile(join(root, '.gitignore'), '\n.env.local\n');
	await writeFile(
		join(root, '.env.local'),
		'HARNESS_GAME_OPENAI_API_KEY=synthetic-game-test-key\n',
		{ mode: 0o600 }
	);
}

/** Keep native exit/crash diagnostics after disposable profiles are removed. */
function watchHost(app: ElectronApplication, profile: string) {
	const directory = join(desktop, '.cache/game-native-host');
	mkdirSync(directory, { recursive: true });
	const path = join(directory, basename(profile) + '.ndjson');
	const log = (event: string, data: unknown) =>
		appendFileSync(path, JSON.stringify({ at: new Date().toISOString(), event, data }) + '\n');
	log('launched', { pid: app.process().pid, profile });
	app.process().stderr?.on('data', (chunk) => log('stderr', String(chunk)));
	app.process().stdout?.on('data', (chunk) => log('stdout', String(chunk)));
	app.process().on('exit', (code, signal) => log('exit', { code, signal }));
	app.context().on('close', () => log('context-close', null));
	for (const page of app.context().pages()) {
		page.on('crash', () => log('renderer-crash', page.url()));
		page.on('close', () => log('page-close', page.url()));
	}
}

export async function createNativeGame(page: Page, name: string, dimension: string) {
	await expect(page.getByRole('button', { name: 'Open Project', exact: true })).toBeVisible();
	await page.getByLabel('Project type', { exact: true }).selectOption('game');
	await page.getByLabel('Dimension', { exact: true }).selectOption(dimension);
	await page.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
	await capture(page, `${dimension}-creation`);
	await page.getByRole('button', { name: 'Create project', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Game Views', exact: true })).toBeVisible();
	await viewSettings(page);
	await expect(page.getByLabel('Dimension', { exact: true })).toHaveValue(dimension);
	await expect(page.getByText('Demo', { exact: true })).toHaveCount(0);
	await prepareNativeLegacyGame(page, dimension);
}

/** The candidate is explicitly accepted before the real image reference is saved. */
export async function approveCheckpointImage(page: Page) {
	await page
		.getByLabel('Describe your checkpoint', { exact: true })
		.fill('A golden key beside the courtyard explorer');
	await page.getByRole('button', { name: 'Generate image', exact: true }).click();
	await expect(
		page.getByRole('img', { name: 'New checkpoint image for Collect the key', exact: true })
	).toBeVisible();
	await page.getByRole('button', { name: 'Use this image', exact: true }).click();
	await page.getByText('Collect the key', { exact: true }).first().click();
	await expect(
		page.getByRole('img', { name: 'Collect the key gameplay reference', exact: true })
	).toBeVisible();
	await doneCheckpoint(page);
}
