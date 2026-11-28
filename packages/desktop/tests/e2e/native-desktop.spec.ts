import { git, project } from './support/nativeDesktopProjectFixture';
import { nativeImageFixture } from './native-image-fixture';
import { nativeCapture } from './native-capture';
import {
	completeNativeGoogle,
	enableFixtureStorage,
	packagedFixture
} from './support/nativeGoogleFixture';
import {
	electronFixtureEnvironment,
	makeTemporaryDesktopEntry,
	startHubSpy
} from './support/trackerOverviewPublisherFixture';
import { test, expect, _electron } from '../../../../test/support/browserTest';
import type { ElectronApplication, Page } from '../../../../test/support/browserTest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { createPlanning } from '../../../planning/src/lib/planning/index';
import type { DesktopBridge } from '../../src/models/DesktopBridge.types';
import { PlanningFacadeAdapter } from '../../src/adapters/planning-facade-adapter/PlanningFacadeAdapter';
import { chooseRow, currentRow, openRows } from './picker-rows';

const desktopRoot = resolve(import.meta.dirname, '../..');
const electronBinary = createRequire(import.meta.url)('electron') as string;
const packagedApp = packagedFixture();
test.setTimeout(120_000);
async function isolation(app: ElectronApplication, page: Page) {
	const preferences = await app.evaluate(({ BrowserWindow }) => {
		const contents = BrowserWindow.getAllWindows()[0].webContents;
		// Electron exposes this diagnostic getter without a public type declaration.
		const read = Reflect.get(contents, 'getLastWebPreferences') as () => Electron.WebPreferences;
		const options = read.call(contents);
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
/** Seed the review fixture through the real facade; creation now belongs to the agent flow. */
async function openDraftThroughUi(page: Page, root: string) {
	await (
		await PlanningFacadeAdapter.open(root)
	).createPlan({
		category: 'pages',
		title: 'Native activity',
		goal: 'Review committed images through the native bridge.'
	});
	await page.getByRole('button', { name: 'Open project', exact: true }).click();
	await expect(page.locator('.revision-summary strong')).toHaveText('feat/native');
	await expect(page.getByRole('button', { name: 'New page' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Work with agent', exact: true })).toBeVisible();
	await page.getByRole('link', { name: 'Open Native activity', exact: true }).click();
	const sections = page.getByRole('navigation', { name: 'Entity sections' });
	await sections.getByRole('button', { name: 'Designs', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'No design image yet' })).toBeVisible();
	const tip = git(root, 'rev-parse', 'HEAD');
	await expect(await currentRow(page, 'Choose commit')).toContainText(tip.slice(0, 7));
	await page.keyboard.press('Escape');
	await expect(await openRows(page, 'Choose branch')).toContainText(
		`Branch tip ${tip.slice(0, 7)} committed`
	);
	await page.keyboard.press('Escape');
	const api = await createPlanning(root),
		plans = await api.listPlans();
	expect(plans).toHaveLength(1);
	expect(plans[0].title).toBe('Native activity');
	await nativeCapture(page, { state: 'draft', unitId: plans[0].unitId, commit: tip });
	return plans[0].unitId;
}
async function committedImage(page: Page, root: string, unitId: string) {
	const api = await createPlanning(root);
	const bytes = nativeImageFixture();
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
	const received = await page.evaluate(
		async ({ unitId, imageCommit }) => {
			const bridge = (window as unknown as { harness: DesktopBridge }).harness;
			const entity = await bridge.entity({ entityId: unitId, commit: imageCommit });
			return Array.from(
				await bridge.image({
					entityId: unitId,
					commit: imageCommit,
					version: 'v001',
					sha256: entity.versions[0].images[0].sha256
				})
			);
		},
		{ unitId, imageCommit }
	);
	expect(received).toEqual(Array.from(bytes));
	await nativeCapture(page, { state: 'design', unitId, commit: imageCommit });
	await page.getByRole('button', { name: 'Approve v001', exact: true }).click();
	await expect(
		page.getByRole('button', { name: 'Design v001 approved', exact: true })
	).toBeVisible();
	const detail = await api.readPlan({ unitId });
	expect(detail.approval?.current).toBe(true);
	expect(detail.approval?.images).toHaveLength(1);
	expect(git(root, 'status', '--porcelain')).toBe('');
	await nativeCapture(page, { state: 'approved', unitId, commit: git(root, 'rev-parse', 'HEAD') });
	return imageCommit;
}
async function historical(page: Page, commit: string, unitId: string) {
	await chooseRow(page, 'Choose commit', commit.slice(0, 7));
	await expect(page).toHaveURL(new RegExp(`/branch/feat%2Fnative/commit/${commit}/pages$`));
	await expect(page.getByRole('button', { name: 'Work with agent', exact: true })).toHaveCount(0);
	await page.getByRole('button', { name: 'Open project chat', exact: true }).click();
	const chat = page.getByRole('complementary', { name: 'Project agent', exact: true });
	await expect(chat.getByRole('button', { name: /^(Plan|Ask|Change)$/ })).toHaveCount(0);
	await chat.getByRole('button', { name: 'Close chat', exact: true }).click();
	await page.getByRole('link', { name: 'Open Native activity' }).click();
	await expect(page.getByRole('button', { name: 'Approve v001', exact: true })).toBeDisabled();
	await nativeCapture(page, { state: 'history', unitId, commit });
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
test('native isolated window uses real Git LFS planning and rejects historical writes/navigation', async ({
	browserErrors
}) => {
	const temp = await mkdtemp(join(tmpdir(), 'harness-native-')),
		root = join(temp, 'repo');
	const hub = await startHubSpy();
	const profile = join(temp, 'profile');
	let app: ElectronApplication | undefined;
	try {
		await project(root);
		app = await _electron.launch({
			executablePath: packagedApp ? join(packagedApp, 'Contents/MacOS/Harness') : electronBinary,
			args: packagedApp
				? [`--user-data-dir=${profile}`]
				: [await makeTemporaryDesktopEntry(temp, desktopRoot)],
			env: { ...electronFixtureEnvironment(), HARNESS_HUB_ORIGIN: hub.origin }
		});
		browserErrors.watch(app.context());
		await app.evaluate(({ dialog }, directory) => {
			dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [directory] });
		}, root);
		const page = await app.firstWindow();
		await page.waitForLoadState('domcontentloaded');
		await enableFixtureStorage(app, profile);
		await completeNativeGoogle(app, page, hub.login);
		await isolation(app, page);
		const unitId = await openDraftThroughUi(page, root);
		const imageCommit = await committedImage(page, root, unitId);
		await historical(page, imageCommit, unitId);
		await blockedNavigation(app, page);
	} finally {
		await app?.close();
		await hub.close();
		await rm(temp, { recursive: true, force: true });
	}
});
