import { assertWorkspaceHeaderFits, fakeProject } from './ui-workspace-fixture';
import { expect, test, type Locator, type Page } from '../../../../test/support/browserTest';

const categoryNav = (page: Page) => page.getByRole('navigation', { name: 'Catalog categories' });
const box = async (locator: Locator) => (await locator.boundingBox())!;

/** U11: at phone width the category links are one horizontally scrolling row, not two rows. */
test('at 390 pixels the categories are one scrolling row that keeps the active one in view', async ({
	page
}) => {
	await fakeProject(page);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/');
	await page.getByRole('button', { name: 'Open project', exact: true }).click();
	const nav = categoryNav(page);
	await expect(nav).toBeVisible();
	await page.evaluate(() => document.fonts.ready);
	const links = await nav.getByRole('link').all();
	expect(links.length).toBeGreaterThanOrEqual(8);
	const tops = await Promise.all(links.map(async (link) => Math.round((await box(link)).y)));
	expect(new Set(tops).size, 'Every category link sits on one row').toBe(1);
	expect(
		await nav.evaluate((element) => element.scrollWidth > element.clientWidth),
		'The row scrolls sideways when the categories do not fit'
	).toBe(true);
	const last = links.at(-1)!;
	const lastHref = await last.getAttribute('href');
	expect(lastHref).toBeTruthy();
	await page.goto(lastHref!);
	await expect(nav.locator('.active')).toHaveAttribute('href', lastHref!);
	const active = await box(nav.locator('.active'));
	const row = await box(categoryNav(page));
	expect(
		[active.x >= row.x - 1, active.x + active.width <= row.x + row.width + 1],
		'A category opened on a phone is scrolled into view'
	).toEqual([true, true]);
	expect(await nav.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
	await assertWorkspaceHeaderFits(page, 390);
});
