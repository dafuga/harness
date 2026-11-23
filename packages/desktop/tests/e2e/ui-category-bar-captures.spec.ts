import { fileURLToPath } from 'node:url';
import { expect, test } from '../../../../test/support/browserTest';
import { fakeProject } from './ui-workspace-fixture';

/**
 * Fresh captures of the U11 category bar on a workspace page, written to the design record.
 * Opt-in: TAKE_SCREENSHOT=true.
 */
const screens = fileURLToPath(
	new URL('../../../../specification/designs/full-pass/screens/', import.meta.url)
);
for (const [name, size, scale] of [
	['phone', { width: 390, height: 844 }, 2],
	['tablet', { width: 834, height: 1112 }, 1],
	['laptop', { width: 1440, height: 900 }, 1]
] as const) {
	test.describe(`category bar captures at ${name}`, () => {
		test.skip(process.env.TAKE_SCREENSHOT !== 'true', 'Screenshots are opt-in.');
		test.use({ viewport: size, deviceScaleFactor: scale });
		test(`category bar at ${name}`, async ({ page }) => {
			await fakeProject(page);
			await page.goto('/');
			await page.getByRole('button', { name: 'Open project', exact: true }).click();
			await expect(
				page.getByRole('navigation', { name: 'Catalog categories' }).getByRole('link').first()
			).toBeVisible();
			await page.evaluate(() => document.fonts.ready);
			await page.mouse.move(0, 0);
			await page.screenshot({ path: `${screens}after--category-bar--${name}.png` });
		});
	});
}
