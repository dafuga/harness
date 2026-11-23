import { expect, test, type Locator, type Page } from '../../../../test/support/browserTest';
import { agentAt, agentSettingsFixture } from './agent-settings-fixture';
import { alpha } from './ui-project-fixture';

/** The polish pass of s4mpm1: rendered behaviour only, at the widths the screens are designed for. */
const apisAt = `/projects/${alpha}/harness/branch/feat%2Falpha/apis`;

async function box(locator: Locator) {
	await expect(locator).toBeVisible();
	const value = await locator.boundingBox();
	expect(value).not.toBeNull();
	return value!;
}

async function noOverflow(page: Page, width: number) {
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
		width
	);
}

test('a catalog states how many it lists instead of a breadcrumb and a slogan', async ({
	page
}) => {
	await agentSettingsFixture(page);
	await page.goto(agentAt);
	const main = page.getByRole('main');
	await expect(main.getByRole('heading', { name: 'Components', level: 1 })).toBeVisible();
	await expect(main.getByRole('status').filter({ hasText: /component/ })).toHaveText('1 component');
	await expect(main.getByText(/›/)).toHaveCount(0);
	await expect(main.getByText(/understand your project/)).toHaveCount(0);
	await main.getByRole('searchbox', { name: 'Search components' }).fill('nothing matches this');
	await expect(main.getByRole('status').filter({ hasText: /component/ })).toHaveText(
		'0 of 1 components shown'
	);
	await page.goto(apisAt);
	await expect(page.getByRole('heading', { name: 'APIs', level: 1 })).toBeVisible();
});

test('a tablet toolbar keeps search on the revision row', async ({ page }) => {
	await page.setViewportSize({ width: 834, height: 1112 });
	await agentSettingsFixture(page);
	await page.goto(agentAt);
	const search = await box(page.getByRole('button', { name: 'Search entities', exact: true }));
	const branch = await box(page.getByRole('button', { name: 'Choose branch', exact: true }));
	expect(Math.abs(search.y + search.height / 2 - (branch.y + branch.height / 2))).toBeLessThan(8);
	const branchName = await box(
		page.getByText('feat/alpha', { exact: true }).filter({ visible: true })
	);
	expect(branchName.x + branchName.width).toBeLessThanOrEqual(search.x);
	await noOverflow(page, 834);
});

test('settings is one card with each setting on a row, and goes back home by name', async ({
	page
}) => {
	await agentSettingsFixture(page);
	await page.goto('/settings');
	const back = page.getByRole('link', { name: 'Back to home', exact: true });
	expect((await box(back)).height).toBeGreaterThanOrEqual(44);
	const name = await box(page.getByText('Design options', { exact: true }).first());
	const control = await box(page.getByRole('combobox', { name: 'Design options' }));
	expect(control.x).toBeGreaterThan(name.x + name.width);
	expect(Math.abs(control.y + control.height / 2 - (name.y + name.height / 2))).toBeLessThan(8);
	await page.setViewportSize({ width: 390, height: 844 });
	await noOverflow(page, 390);
	await back.click();
	await expect(page).toHaveURL(/\/$/);
});
