import { expect, test } from '../../../../test/support/browserTest';
import { mkdir } from 'node:fs/promises';
import { expectRetired } from './support/portableReport';
import { categories as expectedCategories } from './support/explorer';
const evidence = '/tmp/harness-analytics-evidence';

// The analytics dashboard is gone. Its address must lead somewhere and never show a dead page:
// it leads into the explorer's current categories, with no analytics among them.
test('the analytics address leads into the explorer, which has no analytics screen', async ({
	page
}) => {
	await expectRetired(page, '/analytics');
	await page.evaluate(async () => {
		await document.fonts.ready;
	});
	if (process.env.TAKE_SCREENSHOT === 'true') {
		await mkdir(evidence, { recursive: true });
		await page.screenshot({
			path: `${evidence}/${process.env.SCREENSHOT_LABEL ?? 'test'}.png`,
			fullPage: true
		});
	}
	await expect(page.getByRole('heading', { name: /Analytics/ })).toHaveCount(0);
	await expect(page.getByText('Response first try', { exact: true })).toHaveCount(0);
	const categories = page
		.getByRole('navigation', { name: 'Harness categories' })
		.locator('a, button');
	await expect(categories).toHaveText(expectedCategories);
	await expect(page.getByRole('link', { name: /analytics|reports|activity/i })).toHaveCount(0);
});

test('the analytics route still responds successfully, with the page it leads to', async ({
	page
}) => {
	const response = await page.goto('/analytics');
	// The answer a browser ends on is a page that rendered, not an error and not a blank one.
	expect(response?.status()).toBe(200);
	expect(new URL(page.url()).pathname).toMatch(/^\/harness\/branch\/[^/]+\/pages$/);
	await expect(page.getByRole('heading', { level: 1, name: 'Pages' })).toBeVisible();
	const first = await page.request.get('/analytics', { maxRedirects: 0 });
	expect(first.status()).toBeGreaterThanOrEqual(301);
	expect(first.status()).toBeLessThanOrEqual(308);
});
