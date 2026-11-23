import { expect, test, type Locator, type Page } from '../../../../test/support/browserTest';
import { hostedFixture } from './hosted-fixture';

/**
 * The hosted header at phone width: the logo, the page title and one Menu button on a single row
 * of at most 64px. The account links open in the shared Modal as rows; wider screens keep them
 * in the header.
 */
const phone = { width: 390, height: 844 };
const tablet = { width: 834, height: 1112 };
const headerMaximum = 64;
const touchTarget = 44;
const accountLinks = ['Projects', 'Devices', 'Download'] as const;
test.setTimeout(60_000);

async function box(locator: Locator) {
	const found = await locator.boundingBox();
	if (!found) throw new Error('The element has no layout box.');
	return found;
}

async function overflow(page: Page) {
	const extra = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(extra).toBe(0);
}

test('the phone header is one row with a Menu button that holds the account links', async ({
	page
}) => {
	await page.setViewportSize(phone);
	await hostedFixture(page);
	await page.goto('/projects');
	const header = page.locator('.hub-page .topbar');
	const brand = page.getByRole('link', { name: 'Harness', exact: false }).first();
	const title = page.locator('.hub-title');
	const menu = page.getByRole('button', { name: 'Menu', exact: true });
	await expect(menu).toBeVisible();
	await expect(title).toBeVisible();
	const bar = await box(header);
	expect(bar.height).toBeLessThanOrEqual(headerMaximum);
	const centres = await Promise.all(
		[brand, title, menu].map(async (item) => {
			const found = await box(item);
			return found.y + found.height / 2;
		})
	);
	for (const centre of centres) expect(Math.abs(centre - centres[0])).toBeLessThanOrEqual(2);
	await overflow(page);

	await menu.click();
	const dialog = page.getByRole('dialog', { name: 'Menu', exact: true });
	await expect(dialog).toBeVisible();
	for (const name of accountLinks) {
		const link = dialog.getByRole('link', { name, exact: true });
		await expect(link).toBeVisible();
		expect((await box(link)).height).toBeGreaterThanOrEqual(touchTarget);
	}
	const signOut = dialog.getByRole('button', { name: 'Sign out', exact: true });
	await expect(signOut).toBeVisible();
	expect((await box(signOut)).height).toBeGreaterThanOrEqual(touchTarget);
	await expect(dialog.getByText('Ada Example', { exact: true })).toBeVisible();
	await overflow(page);
});

test('wider screens keep the account links in the header and show no Menu button', async ({
	page
}) => {
	await page.setViewportSize(tablet);
	await hostedFixture(page);
	await page.goto('/projects');
	const header = page.locator('.hub-page .topbar');
	for (const name of accountLinks) {
		await expect(header.getByRole('link', { name, exact: true })).toBeVisible();
	}
	await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeHidden();
});
