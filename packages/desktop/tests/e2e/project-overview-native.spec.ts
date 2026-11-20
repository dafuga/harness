import { expect, test } from '../../../../test/support/browserTest';
import { captureOverview, fakeOverviewBridge } from './support/projectOverviewNativeFixture';
import type { OverviewBridge } from './support/projectOverviewNativeFixture.types';

const viewports = [
	{ name: 'desktop', width: 1440, height: 900 },
	{ name: 'tablet', width: 834, height: 1112 },
	{ name: 'mobile', width: 390, height: 844 }
];

test('the desktop landing reaches the overview, which shows the synthetic states', async ({
	page
}) => {
	await fakeOverviewBridge(page, 'ready');
	await page.goto('/');
	await page.getByRole('link', { name: 'Project Overview', exact: true }).click();
	await expect(page).toHaveURL(/\/projects$/);
	await expect(page.getByText('fixture-needs', { exact: true }).first()).toBeVisible();
	await expect(page.getByText('fixture-done', { exact: true }).first()).toBeVisible();
});

test('an open item shows its read-only detail within the page', async ({ page }) => {
	await fakeOverviewBridge(page, 'ready');
	await page.goto('/projects');
	await page.getByRole('button', { name: 'Open item', exact: true }).first().click();
	await expect(
		page.getByText('Synthetic question for the owner?', { exact: true }).first()
	).toBeVisible();
	await expect(page).toHaveURL(/\/projects$/);
});

for (const viewport of viewports) {
	test(`the overview fits the ${viewport.name} viewport with its states and captures it`, async ({
		page
	}) => {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		await fakeOverviewBridge(page, 'ready');
		await page.goto('/projects');
		await expect(page.getByText('fixture-blocked', { exact: true }).first()).toBeVisible();
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
			viewport.width
		);
		await captureOverview(page, viewport.name);
	});
}

for (const mode of ['web', 'absent', 'refused'] as OverviewBridge[]) {
	test(`without a local tracker read (${mode}) the page shows no tracker data`, async ({
		page
	}) => {
		await fakeOverviewBridge(page, mode);
		await page.goto('/projects');
		await expect(page).toHaveTitle('Projects · Harness');
		await expect(page.getByText('fixture-needs', { exact: true })).toHaveCount(0);
		await expect(page.getByText('fixture-blocked', { exact: true })).toHaveCount(0);
	});
}

test('a page without the desktop bridge offers no overview link', async ({ page }) => {
	await fakeOverviewBridge(page, 'web');
	await page.goto('/');
	await expect(page.getByRole('link', { name: 'Project Overview', exact: true })).toHaveCount(0);
});
