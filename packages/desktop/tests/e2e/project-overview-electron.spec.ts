import { test, expect, _electron } from '../../../../test/support/browserTest';
import type { ElectronApplication, Page } from '../../../../test/support/browserTest';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
	LEAK_SENTINELS,
	syntheticTrackerPayloads,
	TRACKER_URLS
} from './support/projectOverviewElectronFixture';
import {
	makeTemporaryDesktopEntry,
	OWNER,
	seedHostedPage,
	startHubSpy
} from './support/trackerOverviewPublisherFixture';
import type { HubSpy } from './support/trackerOverviewPublisherFixture';
import { readProjectOverview } from '../../../reports/src/lib/projects-sessions/project-overview/readProjectOverview';

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
async function launchBuilt(temp: string, hub: HubSpy): Promise<ElectronApplication> {
	const env = Object.fromEntries(
		Object.entries(process.env).filter(
			([key, value]) => key !== 'ELECTRON_RUN_AS_NODE' && value !== undefined
		)
	) as Record<string, string>;
	return _electron.launch({
		executablePath: electronBinary,
		args: [await makeTemporaryDesktopEntry(temp, desktopRoot)],
		env: { ...env, HARNESS_HUB_ORIGIN: hub.origin }
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

function expectOwnerReads(hub: HubSpy) {
	const requests = hub.records.filter(({ path }) => path === '/api/tracker-overview');
	expect(requests.length).toBeGreaterThan(0);
	expect(requests.every(({ method, bearer }) => method === 'GET' && bearer === OWNER.token)).toBe(
		true
	);
	// The signed-in desktop registers itself independently of the read-only overview.
	const mutations = hub.records
		.filter(
			({ method, path }) => method !== 'GET' && !(method === 'POST' && path === '/api/remote/hosts')
		)
		.map(({ method, path }) => ({ method, path }));
	expect(mutations).toEqual([]);
}

async function overviewHub(ready: boolean) {
	const now = Date.now();
	const payloads = syntheticTrackerPayloads(now);
	const fetcher = async (url: RequestInfo | URL) => {
		const key = Object.entries(TRACKER_URLS).find(
			([, path]) => path === String(url)
		)?.[0] as keyof typeof payloads;
		if (!key) return new Response(null, { status: 404 });
		return Response.json(payloads[key]);
	};
	return startHubSpy(ready ? await readProjectOverview(fetcher as typeof fetch, now) : undefined);
}

test('the built app opens the owner overview through the signed-in Hub account', async ({
	browserErrors
}) => {
	const temp = await mkdtemp(join(tmpdir(), 'harness-overview-'));
	const hub = await overviewHub(true);
	let app: ElectronApplication | undefined;
	try {
		app = await launchBuilt(temp, hub);
		browserErrors.watch(app.context());
		const page = await seedHostedPage(app, join(temp, 'profile'), hub);
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
		expectOwnerReads(hub);
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
		await hub.close();
		await rm(temp, { recursive: true, force: true });
	}
});

test('an open item shows read-only detail and writes nothing to the tracker', async ({
	browserErrors
}) => {
	const temp = await mkdtemp(join(tmpdir(), 'harness-overview-'));
	const hub = await overviewHub(true);
	let app: ElectronApplication | undefined;
	try {
		app = await launchBuilt(temp, hub);
		browserErrors.watch(app.context());
		const page = await seedHostedPage(app, join(temp, 'profile'), hub);
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
		expectOwnerReads(hub);
	} finally {
		await app?.close();
		await hub.close();
		await rm(temp, { recursive: true, force: true });
	}
});

test('an unavailable Hub overview shows no project data', async ({ browserErrors }) => {
	const temp = await mkdtemp(join(tmpdir(), 'harness-overview-'));
	const hub = await overviewHub(false);
	let app: ElectronApplication | undefined;
	try {
		app = await launchBuilt(temp, hub);
		browserErrors.watch(app.context());
		const page = await seedHostedPage(app, join(temp, 'profile'), hub);
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
		expectOwnerReads(hub);
	} finally {
		await app?.close();
		await hub.close();
		await rm(temp, { recursive: true, force: true });
	}
});
