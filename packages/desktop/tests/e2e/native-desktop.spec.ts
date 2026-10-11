import { desktopEvidence } from './desktop-evidence';
import { test, expect, _electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { createPlanning } from '../../../planning/src/index';
import type { DesktopBridge } from '../../src/models/DesktopBridge.types';

const desktopRoot = resolve(import.meta.dirname, '../..');
const electronBinary = createRequire(import.meta.url)('electron') as string;
test.setTimeout(120_000);
function git(root: string, ...args: string[]) {
	return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}
async function project(root: string) {
	await mkdir(root);
	git(root, 'init', '-b', 'feat/native');
	git(root, 'lfs', 'install', '--local');
	git(root, 'config', 'user.name', 'Harness Native Fixture');
	git(root, 'config', 'user.email', 'fixture@example.invalid');
	git(root, 'config', 'commit.gpgsign', 'false');
	await writeFile(join(root, 'README.md'), 'Disposable native acceptance fixture.\n');
	git(root, 'add', 'README.md');
	git(root, 'commit', '-m', 'chore: seed native acceptance');
	return git(root, 'rev-parse', 'HEAD');
}
async function capture(page: Page, name: string) {
	await desktopEvidence(page, name, true);
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	if (name !== 'draft') {
		await page.locator('.image-canvas img').waitFor({ state: 'visible' });
		await page.locator('.version-thumbnail').waitFor({ state: 'visible' });
	}
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
	});
	await page.mouse.move(0, 0);
	await page.screenshot({
		path: join(desktopRoot, 'test-results', `native-${name}.png`),
		fullPage: true
	});
}
async function isolation(app: ElectronApplication, page: Page) {
	const preferences = await app.evaluate(({ BrowserWindow }) => {
		const options = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
		return {
			sandbox: options?.sandbox,
			contextIsolation: options?.contextIsolation,
			nodeIntegration: options?.nodeIntegration
		};
	});
	expect(preferences).toEqual({ sandbox: true, contextIsolation: true, nodeIntegration: false });
	expect(
		await page.evaluate(() => typeof (window as unknown as { require: unknown }).require)
	).toBe('undefined');
	expect(
		await page.evaluate(
			() => typeof (window as unknown as { harness: DesktopBridge }).harness.openProject
		)
	).toBe('function');
}
async function createThroughUi(page: Page, root: string) {
	await page.getByRole('button', { name: 'Open Project', exact: true }).click();
	await expect(page.getByLabel('Branch', { exact: true })).toHaveValue('feat/native');
	await page.getByRole('button', { name: 'New page' }).click();
	await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Native activity');
	await page
		.getByRole('textbox', { name: 'Goal', exact: true })
		.fill('Review committed images through the native bridge.');
	await page.getByRole('button', { name: 'Create plan', exact: true }).click();
	await capture(page, 'draft');
	await expect(page.getByRole('heading', { name: 'No design image yet' })).toBeVisible();
	const tip = git(root, 'rev-parse', 'HEAD');
	await expect(page.getByLabel('Commit', { exact: true })).toHaveValue(tip);
	await expect(page.getByText(`Tip · ${tip.slice(0, 7)}`, { exact: true })).toBeVisible();
	const api = await createPlanning(root),
		plans = await api.listPlans();
	expect(plans).toHaveLength(1);
	expect(plans[0].title).toBe('Native activity');
	return plans[0].unitId;
}
async function committedImage(page: Page, root: string, unitId: string) {
	const api = await createPlanning(root);
	const bytes = new Uint8Array(
		await readFile(
			resolve(
				desktopRoot,
				'../../specification/designs/harness-image-threads/pages/activity/designs/v002/desktop.png'
			)
		)
	);
	await api.addDesign({
		unitId,
		prompt: 'Native fixture image, no agent run.',
		generator: { provider: 'fixture', model: 'committed-png' },
		images: [{ state: 'default', viewport: 'desktop', bytes }],
		expectedLatest: null
	});
	const imageCommit = git(root, 'rev-parse', 'HEAD');
	await page.reload();
	await expect(
		page.getByRole('img', { name: 'Native activity v001 desktop default', exact: true })
	).toBeVisible();
	const count = await page.evaluate(
		async ({ unitId, imageCommit }) => {
			const bridge = (window as unknown as { harness: DesktopBridge }).harness;
			const entity = await bridge.entity({ entityId: unitId, commit: imageCommit });
			return (
				await bridge.image({
					entityId: unitId,
					commit: imageCommit,
					version: 'v001',
					sha256: entity.versions[0].images[0].sha256
				})
			).byteLength;
		},
		{ unitId, imageCommit }
	);
	expect(count).toBe(bytes.length);
	await capture(page, 'design');
	await page.getByRole('button', { name: 'Approve v001', exact: true }).click();
	await expect(
		page.getByRole('button', { name: 'Design v001 approved', exact: true })
	).toBeVisible();
	const detail = await api.readPlan({ unitId });
	expect(detail.approval?.current).toBe(true);
	expect(detail.approval?.images).toHaveLength(1);
	expect(git(root, 'status', '--porcelain')).toBe('');
	await capture(page, 'approved');
	return imageCommit;
}
async function historical(page: Page, commit: string) {
	await page.getByLabel('Commit', { exact: true }).selectOption(commit);
	await expect(page).toHaveURL(new RegExp(`/branch/feat%2Fnative/commit/${commit}/pages$`));
	await expect(page.getByRole('button', { name: 'New page' })).toBeDisabled();
	await page.getByRole('link', { name: 'Review designs' }).click();
	await capture(page, 'history');
	await expect(page.getByRole('button', { name: 'Approve v001', exact: true })).toBeDisabled();
	const rejected = await page.evaluate(async () => {
		try {
			await (window as unknown as { harness: DesktopBridge }).harness.createPlan({
				category: 'pages',
				title: 'Forbidden',
				goal: 'Must remain read-only'
			});
			return false;
		} catch {
			return true;
		}
	});
	expect(rejected).toBe(true);
}
async function blockedNavigation(app: ElectronApplication, page: Page) {
	const original = page.url();
	await app.evaluate(({ BrowserWindow }) => {
		BrowserWindow.getAllWindows()[0].webContents.once('will-navigate', (event, url) => {
			Object.assign(globalThis, {
				nativeNavigationProbe: { url, prevented: event.defaultPrevented }
			});
		});
	});
	await page.evaluate(() => {
		location.href = 'https://example.invalid/native-test';
	});
	await expect
		.poll(() =>
			app.evaluate(
				() => (globalThis as unknown as { nativeNavigationProbe: unknown }).nativeNavigationProbe
			)
		)
		.toEqual({ url: 'https://example.invalid/native-test', prevented: true });
	expect(page.url()).toBe(original);
	expect(
		await page.evaluate(
			() => window.open('https://example.invalid/native-popup', '_blank') === null
		)
	).toBe(true);
	expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
}
test('native isolated window uses real Git LFS planning and rejects historical writes/navigation', async () => {
	const temp = await mkdtemp(join(tmpdir(), 'harness-native-')),
		root = join(temp, 'repo');
	let app: ElectronApplication | undefined;
	try {
		await project(root);
		const env = Object.fromEntries(
			Object.entries(process.env).filter(
				([key, value]) => key !== 'ELECTRON_RUN_AS_NODE' && value !== undefined
			)
		) as Record<string, string>;
		app = await _electron.launch({
			executablePath: electronBinary,
			args: [desktopRoot, `--user-data-dir=${join(temp, 'profile')}`],
			env
		});
		await app.evaluate(({ dialog }, directory) => {
			dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [directory] });
		}, root);
		const page = await app.firstWindow();
		await page.waitForLoadState('domcontentloaded');
		await isolation(app, page);
		const unitId = await createThroughUi(page, root);
		const imageCommit = await committedImage(page, root, unitId);
		await historical(page, imageCommit);
		await blockedNavigation(app, page);
	} finally {
		await app?.close();
		await rm(temp, { recursive: true, force: true });
	}
});
