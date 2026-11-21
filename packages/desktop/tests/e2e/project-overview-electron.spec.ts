import { test, expect, _electron } from '../../../../test/support/browserTest';
import type { ElectronApplication, Page } from '../../../../test/support/browserTest';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
	installTrackerDouble,
	LEAK_SENTINELS,
	syntheticTrackerPayloads,
	trackerRequests,
	TRACKER_ORIGIN,
	TRACKER_URLS
} from './support/projectOverviewElectronFixture';
import type { TrackerDouble } from './support/projectOverviewNativeFixture.types';

/** The built desktop app: package.json main is dist/main.cjs, produced by `bun run build`. */
const desktopRoot = resolve(import.meta.dirname, '../..');
const electronBinary = createRequire(import.meta.url)('electron') as string;
/** BrowserWindow.minWidth is 800, so the native canonical viewports are desktop and tablet. */
const viewports = [
	{ name: 'desktop', width: 1440, height: 900 },
	{ name: 'tablet', width: 920, height: 800 }
];
const stateLabels = ['Needs you', 'Blocked', 'Active', 'Quiet', 'Done'];
const cardAgents = [
	'fixture-needs',
	'fixture-blocked',
	'fixture-active',
	'fixture-quiet',
	'fixture-done'
];
const excludedTitles = [
	'Synthetic sensitive title',
	'Sensitive question must not show',
	'Synthetic deleted item',
	'Synthetic ignored item',
	'Synthetic unnamed item'
];

test.setTimeout(120_000);

/** Launches the built app with an isolated, disposable profile; no developer profile is touched. */
async function launchBuilt(temp: string): Promise<ElectronApplication> {
	const env = Object.fromEntries(
		Object.entries(process.env).filter(
			([key, value]) => key !== 'ELECTRON_RUN_AS_NODE' && value !== undefined
		)
	) as Record<string, string>;
	return _electron.launch({
		executablePath: electronBinary,
		args: [desktopRoot, `--user-data-dir=${join(temp, 'profile')}`],
		env
	});
}

/** Sets the window's content size and waits until the renderer reports that viewport. */
async function setViewport(app: ElectronApplication, page: Page, width: number, height: number) {
	await app.evaluate(
		({ BrowserWindow }, size) => {
			BrowserWindow.getAllWindows()[0].setContentSize(size.width, size.height);
		},
		{ width, height }
	);
	await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(width);
}

/** Records the page once its fonts settle, only when screenshots were requested. */
async function captureOverview(page: Page, name: string) {
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	await page.evaluate(() => document.fonts.ready);
	const directory = resolve(desktopRoot, 'test-results');
	await mkdir(directory, { recursive: true });
	await page.screenshot({ path: join(directory, `project-overview-electron-${name}.png`) });
}

/** Every recorded tracker request is one of the fixed GET reads, and none was refused. */
async function expectOnlyFixedReads(app: ElectronApplication, outcome: 'answered' | 'unreachable') {
	const requests = await trackerRequests(app);
	expect(requests.length).toBeGreaterThanOrEqual(Object.keys(TRACKER_URLS).length);
	expect(requests.filter((request) => request.outcome === 'refused')).toEqual([]);
	for (const request of requests) {
		expect(request.method).toBe('GET');
		expect(Object.values(TRACKER_URLS)).toContain(request.url);
		expect(request.outcome).toBe(outcome);
	}
	return requests;
}

test('the built app opens the overview from its landing link and reads the fixed tracker', async ({
	browserErrors
}) => {
	const temp = await mkdtemp(join(tmpdir(), 'harness-overview-')),
		double: TrackerDouble = {
			mode: 'ready',
			origin: TRACKER_ORIGIN,
			urls: TRACKER_URLS,
			payloads: syntheticTrackerPayloads(Date.now())
		};
	let app: ElectronApplication | undefined;
	try {
		app = await launchBuilt(temp);
		browserErrors.watch(app.context());
		await installTrackerDouble(app, double);
		const page = await app.firstWindow();
		await page.waitForLoadState('domcontentloaded');
		await page.getByRole('link', { name: 'Project Overview', exact: true }).click();
		await expect(page).toHaveURL(/\/projects$/);
		for (const agent of cardAgents) {
			await expect(page.getByText(agent, { exact: true }).first()).toBeVisible();
		}
		for (const label of stateLabels) {
			await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
		}
		const badge = page.locator('.po-state[data-state="needs-you"]');
		// The parent flex row blockifies an inline-flex badge.
		await expect(badge).toHaveCSS('display', /^(inline-)?flex$/);
		await expect(badge.locator('.po-mark')).toHaveCSS('width', '8px');
		await expect(badge.locator('.po-mark')).toHaveCSS('height', '8px');
		for (const title of excludedTitles) {
			await expect(page.getByText(title, { exact: true })).toHaveCount(0);
		}
		const html = await page.content();
		for (const sentinel of LEAK_SENTINELS) expect(html).not.toContain(sentinel);
		expect(html).toContain('Synthetic blocked reason [redacted]');
		const bridgeKeys = await page.evaluate(() =>
			Object.keys((window as unknown as { harness: object }).harness)
		);
		expect(bridgeKeys.filter((key) => /token|callback|secret/i.test(key))).toEqual([]);
		await expectOnlyFixedReads(app, 'answered');
		await setViewport(app, page, viewports[0].width, viewports[0].height);
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
			viewports[0].width
		);
		await captureOverview(page, viewports[0].name);
		await setViewport(app, page, viewports[1].width, viewports[1].height);
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
			viewports[1].width
		);
		await captureOverview(page, viewports[1].name);
	} finally {
		await app?.close();
		await rm(temp, { recursive: true, force: true });
	}
});

test('an open item shows read-only detail and writes nothing to the tracker', async ({
	browserErrors
}) => {
	const temp = await mkdtemp(join(tmpdir(), 'harness-overview-')),
		double: TrackerDouble = {
			mode: 'ready',
			origin: TRACKER_ORIGIN,
			urls: TRACKER_URLS,
			payloads: syntheticTrackerPayloads(Date.now())
		};
	let app: ElectronApplication | undefined;
	try {
		app = await launchBuilt(temp);
		browserErrors.watch(app.context());
		await installTrackerDouble(app, double);
		const page = await app.firstWindow();
		await page.waitForLoadState('domcontentloaded');
		await page.getByRole('link', { name: 'Project Overview', exact: true }).click();
		await expect(page).toHaveURL(/\/projects$/);
		await page.getByRole('button', { name: 'Open item', exact: true }).first().click();
		const detail = page.getByRole('dialog');
		await expect(detail).toBeVisible();
		await expect(detail.getByText('Synthetic question item', { exact: true })).toBeVisible();
		await expect(detail.getByText('fx-needs-1', { exact: true })).toBeVisible();
		await expect(detail.locator('input, textarea, select, [contenteditable="true"]')).toHaveCount(
			0
		);
		await page.keyboard.press('Escape');
		await expect(detail).toHaveCount(0);
		await expectOnlyFixedReads(app, 'answered');
	} finally {
		await app?.close();
		await rm(temp, { recursive: true, force: true });
	}
});

test('an unreachable tracker shows the unavailable notice and no project data', async ({
	browserErrors
}) => {
	const temp = await mkdtemp(join(tmpdir(), 'harness-overview-')),
		double: TrackerDouble = {
			mode: 'down',
			origin: TRACKER_ORIGIN,
			urls: TRACKER_URLS,
			payloads: syntheticTrackerPayloads(Date.now())
		};
	let app: ElectronApplication | undefined;
	try {
		app = await launchBuilt(temp);
		browserErrors.watch(app.context());
		await installTrackerDouble(app, double);
		const page = await app.firstWindow();
		await page.waitForLoadState('domcontentloaded');
		await page.getByRole('link', { name: 'Project Overview', exact: true }).click();
		await expect(page).toHaveURL(/\/projects$/);
		await expect(
			page.getByText('The tracker could not be reached from this host, so no projects are shown.', {
				exact: true
			})
		).toBeVisible();
		for (const agent of cardAgents) {
			await expect(page.getByText(agent, { exact: true })).toHaveCount(0);
		}
		await expectOnlyFixedReads(app, 'unreachable');
	} finally {
		await app?.close();
		await rm(temp, { recursive: true, force: true });
	}
});
