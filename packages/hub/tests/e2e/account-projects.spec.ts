import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from '../../../../test/support/browserTest';
import { ada, hostedFixture } from './hosted-fixture';
import { grace, overviewFixture, refusal, viewports, open } from './tracker-overview-fixture';
import type { Viewport } from './tracker-overview-fixture';

/** The owner endpoint answers a signed-in account that is not the owner with 403, on purpose. */
const forbidden = {
	status: 403,
	text: 'Forbidden',
	reason: 'The owner endpoint refuses a signed-in account that is not the owner, on purpose.'
};

/** The owner endpoint answers 503 on purpose when no current snapshot exists; the link still shows. */
const unavailable = {
	status: 503,
	text: 'Service Unavailable',
	reason: 'The owner endpoint answers 503 on purpose when no current snapshot exists.'
};

/** The shared Project Overview renderer on /projects; present only for the owner. */
const overviewRoot =
	'[data-harness-component="projects-sessions-project-overview-project-overview"]';

/** The synthetic unavailable notice the shared renderer shows for an owner whose read answered 503. */
const unavailableNotice =
	'The tracker could not be reached from this host, so no projects are shown.';

/** Attaches the actual compiled page; these shots are not recorded as tracker-overview evidence. */
async function attachShot(page: Page, testInfo: TestInfo, state: string, viewport: Viewport) {
	await page.evaluate(() => document.fonts.ready);
	const body = await page.screenshot({ animations: 'disabled', caret: 'hide' });
	await testInfo.attach(`projects-${state}-${viewport.id}.png`, {
		body,
		contentType: 'image/png'
	});
}

test('the owner sees the Project overview link on /projects and it opens the overview', async ({
	page
}) => {
	const { overview } = await overviewFixture(page, 'ready');
	await page.goto('/projects');
	await expect(page.getByRole('heading', { name: 'Shared projects' })).toBeVisible();
	await page.getByRole('link', { name: 'Project overview', exact: true }).click();
	await expect(page).toHaveURL(/\/tracker-overview$/);
	expect(overview.calls.length).toBeGreaterThan(0);
	expect(overview.calls.every((call) => call.method === 'GET')).toBe(true);
	expect(overview.calls.every((call) => call.path === '/api/tracker-overview')).toBe(true);
	expect(overview.calls.every((call) => call.query === '')).toBe(true);
});

test('an unavailable owner read still offers the link on /projects', async ({
	page,
	browserErrors,
	baseURL
}) => {
	refusal(browserErrors, baseURL!, unavailable);
	await overviewFixture(page, 'unavailable');
	await page.goto('/projects');
	await expect(page.getByRole('link', { name: 'Project overview', exact: true })).toBeVisible();
	await expect(page.getByText(unavailableNotice)).toBeVisible();
	await expect(page.getByText('synthetic-sync', { exact: true })).toHaveCount(0);
});

test('a signed-in non-owner sees the project list and no overview link on /projects', async ({
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
	await expect(page.locator(overviewRoot)).toHaveCount(0);
	await expect(page.getByText('synthetic-sync', { exact: true })).toHaveCount(0);
});

test('signed-out /projects shows Google sign-in and reads no owner endpoint', async ({ page }) => {
	const { overview } = await overviewFixture(page, 'ready', { signedIn: false });
	await page.goto('/projects');
	await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Project overview', exact: true })).toHaveCount(0);
	expect(overview.calls).toEqual([]);
});

test('switching accounts clears the owner link on /projects', async ({
	page,
	browserErrors,
	baseURL
}) => {
	refusal(browserErrors, baseURL!, {
		...forbidden,
		reason: 'After the account switch the owner endpoint refuses the other account on purpose.'
	});
	const { state } = await overviewFixture(page, 'ready');
	await open(page, viewports[0], '/projects');
	await expect(page.getByRole('link', { name: 'Project overview', exact: true })).toBeVisible();
	await expect(page.getByText('synthetic-sync', { exact: true })).toBeVisible();
	state.actor = grace;
	await page.evaluate(() => window.dispatchEvent(new Event('focus')));
	await expect(page.getByRole('link', { name: 'Project overview', exact: true })).toHaveCount(0);
	await expect(page.locator(overviewRoot)).toHaveCount(0);
	await expect(page.getByText('synthetic-sync', { exact: true })).toHaveCount(0);
	await expect(page.getByText(ada.name)).toHaveCount(0);
});

for (const viewport of viewports) {
	test(`owner /projects settles at ${viewport.id}`, async ({ page }, testInfo) => {
		await overviewFixture(page, 'ready');
		await open(page, viewport, '/projects');
		await expect(page.getByRole('link', { name: 'Project overview', exact: true })).toBeVisible();
		await expect(page.locator(overviewRoot)).toBeVisible();
		await expect(page.getByText('synthetic-sync', { exact: true })).toBeVisible();
		await attachShot(page, testInfo, 'owner', viewport);
	});

	test(`non-owner /projects settles at ${viewport.id}`, async ({
		page,
		browserErrors,
		baseURL
	}, testInfo) => {
		refusal(browserErrors, baseURL!, forbidden);
		await overviewFixture(page, 'ready', { actor: grace });
		await open(page, viewport, '/projects');
		await expect(page.getByRole('heading', { name: 'Shared projects' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Project overview', exact: true })).toHaveCount(0);
		await expect(page.locator(overviewRoot)).toHaveCount(0);
		await attachShot(page, testInfo, 'non-owner', viewport);
	});

	test(`signed-out /projects settles at ${viewport.id}`, async ({ page }, testInfo) => {
		await hostedFixture(page, { signedIn: false });
		await open(page, viewport, '/projects');
		await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
		await attachShot(page, testInfo, 'signed-out', viewport);
	});
}
