import type { Page } from '@playwright/test';
import { expect as baseExpect, test } from '../../../../test/support/browserTest';
import { ada } from './hosted-fixture';
import {
	capture,
	grace,
	open,
	overviewFixture,
	refusal,
	viewports
} from './tracker-overview-fixture';

const expect = baseExpect.configure({ timeout: 25_000 });
test.setTimeout(90_000);

/** The five synthetic project names, one per card state. */
const projects = [
	'synthetic-sync',
	'synthetic-relay',
	'synthetic-docs',
	'synthetic-notes',
	'synthetic-release'
];
const cardStates = ['needs-you', 'blocked', 'active', 'quiet', 'done'];
const bands = ['Needs attention', 'Active', 'Quiet', 'Done'];
const denial = 'This account cannot read the Project Overview.';
const forbidden = {
	status: 403,
	text: 'Forbidden',
	reason: 'The owner endpoint refuses a signed-in account that is not the owner, on purpose.'
};
const unavailable = {
	status: 503,
	text: 'Service Unavailable',
	reason: 'The owner endpoint answers 503 on purpose when no current snapshot exists.'
};

/** Fitted: no horizontal document scroll, and no card edge past the viewport's right side. */
async function expectFitted(page: Page) {
	const fit = await page.evaluate(() => ({
		scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
		past: [...document.querySelectorAll('.po-card')].filter(
			(card) => card.getBoundingClientRect().right > innerWidth
		).length
	}));
	expect(fit).toEqual({ scroll: 0, past: 0 });
}

test('the owner sees the link on the projects page, opens it and reads with GET only', async ({
	page
}) => {
	const { overview } = await overviewFixture(page);
	await page.goto('/projects');
	await page.getByRole('link', { name: 'Project overview', exact: true }).click();
	await expect(page).toHaveURL(/\/tracker-overview$/);
	await expect(page.getByText('synthetic-sync', { exact: true })).toBeVisible();
	expect(overview.calls.length).toBeGreaterThan(0);
	expect(overview.calls.every((call) => call.method === 'GET')).toBe(true);
	expect(overview.calls.every((call) => call.path === '/api/tracker-overview')).toBe(true);
	expect(overview.calls.every((call) => call.query === '')).toBe(true);
});

test('an unavailable owner read still offers the link on the projects page', async ({
	page,
	browserErrors,
	baseURL
}) => {
	refusal(browserErrors, baseURL!, unavailable);
	await overviewFixture(page, 'unavailable');
	await page.goto('/projects');
	await expect(page.getByRole('link', { name: 'Project overview', exact: true })).toBeVisible();
});

test('a signed-in non-owner sees no link on the projects page', async ({
	page,
	browserErrors,
	baseURL
}) => {
	refusal(browserErrors, baseURL!, forbidden);
	await overviewFixture(page, 'ready', { actor: grace });
	const refused = page.waitForResponse(
		(response) =>
			new URL(response.url()).pathname === '/api/tracker-overview' && response.status() === 403
	);
	await page.goto('/projects');
	await (await refused).finished();
	await expect(page.getByRole('heading', { name: 'Shared projects' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Project overview', exact: true })).toHaveCount(0);
});

test('phone chips and Open item are at least 44 pixels tall', async ({ page }) => {
	await overviewFixture(page);
	await open(page, viewports[2]);
	await expect(page.getByText('synthetic-sync', { exact: true })).toBeVisible();
	const chip = await page.locator('.po-chip').first().boundingBox();
	const button = await page
		.locator('.po-card.po-needs-you')
		.getByRole('button', { name: 'Open item' })
		.boundingBox();
	expect(chip?.height ?? 0).toBeGreaterThanOrEqual(44);
	expect(button?.height ?? 0).toBeGreaterThanOrEqual(44);
});

for (const viewport of viewports) {
	test(`ready shows the five states and bands at ${viewport.id}`, async ({ page }, testInfo) => {
		await overviewFixture(page);
		await open(page, viewport);
		await expect(page.getByText('synthetic-sync', { exact: true })).toBeVisible();
		for (const name of projects) await expect(page.getByText(name, { exact: true })).toBeVisible();
		for (const state of cardStates) {
			await expect(page.locator(`.po-card.po-${state}`)).toHaveCount(1);
		}
		for (const band of bands) {
			await expect(page.getByRole('heading', { name: band })).toBeVisible();
		}
		await expectFitted(page);
		await capture(page, testInfo, 'ready', viewport);
	});

	test(`item-detail opens read-only and returns focus at ${viewport.id}`, async ({
		page
	}, testInfo) => {
		await overviewFixture(page);
		await open(page, viewport);
		const control = page
			.locator('.po-card.po-needs-you')
			.getByRole('button', { name: 'Open item' });
		await control.focus();
		await page.keyboard.press('Enter');
		const dialog = page.getByRole('dialog');
		await expect(dialog.getByText('Confirm the cutover window')).toBeVisible();
		await expect(dialog.getByText('SYN-1', { exact: true })).toBeVisible();
		const title = await dialog.locator('.viewer-header h2').boundingBox();
		const close = await dialog.locator('.viewer-header button').boundingBox();
		expect(close!.y).toBeLessThan(title!.y + title!.height);
		expect(await dialog.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('1px');
		await capture(page, testInfo, 'item-detail', viewport);
		await page.keyboard.press('Escape');
		await expect(dialog).toHaveCount(0);
		await expect(control).toBeFocused();
	});

	test(`loading shows while the read is in flight at ${viewport.id}`, async ({
		page
	}, testInfo) => {
		const { overview } = await overviewFixture(page, 'held');
		await open(page, viewport);
		await expect(page.getByText('Loading projects…')).toBeVisible();
		await capture(page, testInfo, 'loading', viewport);
		overview.release();
		await expect(page.getByText('synthetic-sync', { exact: true })).toBeVisible();
	});

	test(`empty says there are no projects at ${viewport.id}`, async ({ page }, testInfo) => {
		await overviewFixture(page, 'empty');
		await open(page, viewport);
		await expect(page.getByText('No projects are in the tracker yet.')).toBeVisible();
		await capture(page, testInfo, 'empty', viewport);
	});

	test(`unavailable shows no project at ${viewport.id}`, async ({
		page,
		browserErrors,
		baseURL
	}, testInfo) => {
		refusal(browserErrors, baseURL!, unavailable);
		await overviewFixture(page, 'unavailable');
		await open(page, viewport);
		await expect(
			page.getByText('The tracker could not be reached from this host, so no projects are shown.')
		).toBeVisible();
		await expect(page.getByText('synthetic-sync', { exact: true })).toHaveCount(0);
		await capture(page, testInfo, 'unavailable', viewport);
	});

	test(`denied shows the refusal and no data at ${viewport.id}`, async ({
		page,
		browserErrors,
		baseURL
	}, testInfo) => {
		refusal(browserErrors, baseURL!, forbidden);
		await overviewFixture(page, 'ready', { actor: grace });
		await open(page, viewport);
		await expect(page.getByText(denial)).toBeVisible();
		await expect(page.getByText('synthetic-sync', { exact: true })).toHaveCount(0);
		await capture(page, testInfo, 'denied', viewport);
	});

	test(`signed-out shows sign-in and no owner read at ${viewport.id}`, async ({
		page
	}, testInfo) => {
		const { overview } = await overviewFixture(page, 'ready', { signedIn: false });
		await open(page, viewport);
		await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
		await expect(page.getByText('synthetic-sync', { exact: true })).toHaveCount(0);
		expect(overview.calls).toEqual([]);
		await capture(page, testInfo, 'signed-out', viewport);
	});

	test(`switching accounts clears the owner data at ${viewport.id}`, async ({
		page,
		browserErrors,
		baseURL
	}, testInfo) => {
		refusal(browserErrors, baseURL!, {
			...forbidden,
			reason: 'After the account switch the owner endpoint refuses the other account on purpose.'
		});
		const { state } = await overviewFixture(page);
		await open(page, viewport);
		await expect(page.getByText('synthetic-sync', { exact: true })).toBeVisible();
		state.actor = grace;
		await page.evaluate(() => window.dispatchEvent(new Event('focus')));
		await expect(page.getByText(denial)).toBeVisible();
		for (const name of projects) await expect(page.getByText(name, { exact: true })).toHaveCount(0);
		await expect(page.getByText(ada.name)).toHaveCount(0);
		await capture(page, testInfo, 'switching', viewport);
	});
}

test('a project shows available delivery videos inline in newest-first order', async ({
	page
}, testInfo) => {
	await overviewFixture(page);
	const project = 'synthetic-sync';
	const video = (id: string, title: string, at: string, stage: string) => ({
		id,
		project,
		title,
		at,
		stage,
		sha256: 'a'.repeat(64),
		durationSeconds: 24
	});
	await page.route('**/api/tracker-overview/deliveries?project=synthetic-sync', (route) =>
		route.fulfill({
			json: {
				deliveries: [
					video('testrelease', 'Release to live', '2026-11-28T10:15:00.000Z', 'live'),
					video('testpreview', 'Preview on staging', '2026-11-27T10:15:00.000Z', 'staging')
				],
				cursor: null
			}
		})
	);
	await page.route('**/api/tracker-overview/deliveries?item=*', (route) =>
		route.fulfill({ status: 204 })
	);
	await page.goto('/tracker-overview?project=synthetic-sync');
	await expect(page.getByRole('heading', { name: project, exact: true, level: 1 })).toBeVisible();
	if (process.env.HEADLESS_RUN_ARTIFACTS)
		await page.screenshot({
			path:
				process.env.HEADLESS_RUN_ARTIFACTS + '/project-overview-' + testInfo.project.name + '.png'
		});
	const section = page.getByRole('region', { name: 'Delivered features' });
	await expect(section.getByRole('heading', { level: 3 })).toHaveText(
		['Release to live', 'Preview on staging'],
		{ timeout: 5000 }
	);
	await expect(section.locator('video[controls]')).toHaveCount(2);
	await expect(section.locator('time').first()).toHaveAttribute(
		'datetime',
		'2026-11-28T10:15:00.000Z'
	);
	await expect(section.getByText('Live', { exact: true })).toBeVisible();
});
