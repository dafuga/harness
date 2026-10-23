import { expect, test, type Page, type TestInfo } from '../../../../test/support/browserTest';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { alpha } from './ui-project-fixture';
import { evidenced, shell, withShell } from './ui-shells-fixture';

/**
 * Layouts in the shared app that Web, Electron and iOS render: a category after Pages, listing the
 * shared workspace shell, which Components no longer lists; an old Components address of it opens
 * it under Layouts. A screenshot is kept before the checks of each place when TAKE_SCREENSHOT=true.
 */
const route = (rest: string) => `/projects/${alpha}/harness/branch/feat%2Falpha/${rest}`;
const categories = ['Pages', 'Layouts', 'Components', 'Helpers', 'Configs', 'Services', 'Models'];
const nav = (page: Page) => page.getByRole('navigation', { name: 'Catalog categories' });

/**
 * Keeps the page once the app has settled, its fonts are drawn and its images decoded, before
 * anything is checked; the same moment before and after a change.
 */
async function remember(page: Page, info: TestInfo, state: string): Promise<void> {
	await page.waitForLoadState('networkidle');
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all([...document.images].map((image) => image.decode()));
	});
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	const folder = process.env.SHELLS_SHOTS ?? info.outputDir;
	mkdirSync(folder, { recursive: true });
	const label = process.env.SCREENSHOT_LABEL ?? 'run';
	await page.screenshot({ path: join(folder, `${label}-${state}.png`), fullPage: true });
}

for (const viewport of [
	{ id: 'desktop', width: 1440, height: 900 },
	{ id: 'mobile', width: 390, height: 844 }
]) {
	test(`Layouts follows Pages and lists the shared workspace shell at ${viewport.id} width`, async ({
		page
	}, info) => {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		await withShell(page);
		await page.goto(route('layouts'));
		await remember(page, info, `shells-catalog-${viewport.id}`);
		await expect(nav(page).getByRole('link')).toHaveText(categories);
		await expect(nav(page).getByRole('link', { name: 'Layouts' })).toHaveClass(/active/);
		await expect(page.getByText('Shared workspace shell', { exact: true })).toBeVisible();
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
			viewport.width
		);
		await evidenced(page, 'shells-catalog');
		await nav(page).getByRole('link', { name: 'Components' }).click();
		await expect(page).toHaveURL(route('components'));
		await expect(page.getByText('Alpha button', { exact: true })).toBeVisible();
		await expect(page.getByText('Shared workspace shell', { exact: true })).toHaveCount(0);
	});
}

test('old Components and Shells addresses open the layout, keeping their section', async ({
	page
}, info) => {
	await withShell(page);
	await page.goto(route(`components/${shell}/details`));
	await remember(page, info, 'shell-details-desktop');
	await expect(
		page.getByRole('heading', { level: 1, name: 'Shared workspace shell' })
	).toBeVisible();
	await expect(page).toHaveURL(route(`layouts/${shell}/source`));
	await expect(nav(page).getByRole('link', { name: 'Layouts' })).toHaveClass(/active/);
	await expect(page.locator('.chip').filter({ hasText: /^shell$/ })).toBeVisible();
	await evidenced(page, 'shells-legacy-address');
	await page.goto(route(`shells/${shell}/details`));
	await expect(page).toHaveURL(route(`layouts/${shell}/source`));
	await expect(
		page.getByRole('heading', { level: 1, name: 'Shared workspace shell' })
	).toBeVisible();
});
