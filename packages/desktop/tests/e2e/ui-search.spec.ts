import { expect, test, type Page, type TestInfo } from '../../../../test/support/browserTest';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { hostedFixture } from './ui-hosted-fixture';
import { evidenced } from './ui-search-evidence';
import { alpha, beta, earlier, gamma, searchFixture } from './ui-search-fixture';

/**
 * One search in the top bar of the shared workspace finds entities of all six categories in the
 * shown project and revision, and opens the chosen one with its project, branch and commit kept.
 * A screenshot is kept before the checks of each place when TAKE_SCREENSHOT=true.
 */
const alphaAt = (rest: string) => `/projects/${alpha}/harness/branch/feat%2Falpha/${rest}`;
const field = (page: Page) =>
	page
		.getByRole('dialog', { name: 'Search project' })
		.getByRole('combobox', { name: 'Search entities', exact: true });
const found = (page: Page) => page.getByRole('listbox', { name: 'Entities found', exact: true });
const options = (page: Page) => found(page).getByRole('option');
const sixth = [
	['Page', 'Alpha activity'],
	['Layout', 'Alpha order frame'],
	['Component', 'Alpha button'],
	['Helper', 'Alpha format time'],
	['Config', 'Alpha order limits'],
	['Service', 'Alpha refund service']
];

/** The bar of the project is drawn: the moment before any search is checked, kept when asked. */
async function ready(page: Page, info: TestInfo, name: string): Promise<void> {
	await expect(page.getByRole('navigation', { name: 'Catalog categories' })).toBeVisible();
	await remember(page, info, `ready-${name}`);
	await page.getByRole('button', { name: 'Search entities', exact: true }).click();
}

async function remember(page: Page, info: TestInfo, name: string): Promise<void> {
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all([...document.images].map((image) => image.decode()));
	});
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	const folder = process.env.SEARCH_SHOTS ?? info.outputDir;
	mkdirSync(folder, { recursive: true });
	const file = `${process.env.SCREENSHOT_LABEL ?? 'run'}-${name}.png`;
	await page.screenshot({ path: join(folder, file), fullPage: true, animations: 'disabled' });
}

test('every category of the shown revision is found, and the keyboard opens a shell under Layouts', async ({
	page
}, info) => {
	await searchFixture(page);
	await page.goto(alphaAt('pages'));
	await ready(page, info, 'search-results-desktop');
	await field(page).fill('alpha');
	await expect(options(page)).toHaveCount(6);
	await remember(page, info, 'search-results-desktop');
	for (const [index, [badge, title]] of sixth.entries()) {
		await expect(options(page).nth(index)).toContainText(badge);
		await expect(options(page).nth(index)).toContainText(title);
	}
	await expect(found(page)).not.toContainText('Beta');
	await expect(found(page)).not.toContainText('src/');
	await expect(options(page).first()).toHaveAttribute('aria-selected', 'true');
	await evidenced(page, 'search-results');
	await field(page).press('ArrowDown');
	await expect(options(page).nth(1)).toHaveAttribute('aria-selected', 'true');
	await expect(field(page)).toBeFocused();
	await field(page).press('Enter');
	await expect(page).toHaveURL(alphaAt('layouts/app.shell.order-frame'));
	await expect(page.getByRole('heading', { level: 1, name: 'Alpha order frame' })).toBeVisible();
	await expect(found(page)).toBeHidden();
});

test('Escape closes the list and then clears the field, and nothing found is said', async ({
	page
}, info) => {
	await searchFixture(page);
	await page.goto(alphaAt('pages'));
	await ready(page, info, 'search-empty-desktop');
	await field(page).fill('zzz');
	await remember(page, info, 'search-empty-desktop');
	await expect(page.getByText('No entity matches “zzz”')).toBeVisible();
	await expect(options(page)).toHaveCount(0);
	await field(page).fill('refund');
	await expect(options(page)).toHaveCount(1);
	await field(page).press('Escape');
	await expect(found(page)).toBeHidden();
	await expect(page.getByRole('button', { name: 'Search entities', exact: true })).toBeFocused();
	await page.keyboard.press('ControlOrMeta+k');
	await expect(field(page)).toBeFocused();
	await field(page).fill('limits');
	await options(page).first().click();
	await expect(page).toHaveURL(alphaAt('configs/app.config.order-limits'));
});

test('at a pinned commit only that commit is searched, and the result keeps the commit', async ({
	page
}, info) => {
	await searchFixture(page);
	await page.goto(alphaAt(`commit/${earlier}/pages`));
	await ready(page, info, 'search-pinned-desktop');
	await expect(field(page)).toHaveAttribute('placeholder', 'Search at ccccccc');
	await field(page).fill('format');
	await remember(page, info, 'search-pinned-desktop');
	await expect(page.getByText('No entity matches “format”')).toBeVisible();
	await field(page).fill('legacy');
	await expect(options(page)).toHaveCount(1);
	await evidenced(page, 'search-pinned');
	await field(page).press('Enter');
	await expect(page).toHaveURL(alphaAt(`commit/${earlier}/functions/app.function.legacy-totals`));
});

test('another project is never searched', async ({ page }, info) => {
	await searchFixture(page);
	await page.goto(alphaAt('pages'));
	await ready(page, info, 'search-projects-desktop');
	await field(page).fill('only');
	await expect(page.getByText('No entity matches “only”')).toBeVisible();
	await page.goto(`/projects/${beta}/harness/branch/main/pages`);
	await page.getByRole('button', { name: 'Search entities', exact: true }).click();
	await field(page).fill('only');
	await expect(options(page)).toHaveText([/Helper.*Beta only function/]);
	await field(page).fill('alpha');
	await expect(page.getByText('No entity matches “alpha”')).toBeVisible();
});

test('a shared project, which stays comments-only, has the same search', async ({ page }, info) => {
	await searchFixture(page, hostedFixture);
	await page.goto(`/projects/${gamma}/harness/branch/main/pages`);
	await ready(page, info, 'search-hosted-desktop');
	await field(page).fill('gamma');
	await expect(options(page)).toHaveText([/Page.*Gamma activity/, /Component.*Gamma button/]);
});

for (const viewport of [
	{ id: 'tablet', width: 920, height: 1100 },
	{ id: 'mobile', width: 390, height: 844 }
]) {
	test(`the search is in the top bar at ${viewport.id} width and its results fit the screen`, async ({
		page
	}, info) => {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		await searchFixture(page);
		await page.goto(alphaAt('pages'));
		await ready(page, info, `search-results-${viewport.id}`);
		await expect(field(page)).toBeVisible();
		await field(page).fill('alpha');
		await expect(options(page)).toHaveCount(6);
		await remember(page, info, `search-results-${viewport.id}`);
		const box = await found(page).boundingBox();
		expect(box && box.x >= 0 && box.x + box.width <= viewport.width).toBe(true);
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
			viewport.width
		);
		await evidenced(page, 'search-results');
	});
}
