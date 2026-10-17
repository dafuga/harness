import {
	expect,
	test,
	type Locator,
	type Page,
	type TestInfo
} from '../../../../test/support/browserTest';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { alpha, searchFixture } from './ui-search-fixture';

/**
 * The search of the top bar at every supported width. Closed, focused or with its results open,
 * the field and its focus ring meet neither revision field, which keep the widths they have at that
 * width without the search, the results cover neither, and no page is wider than the screen. A
 * result opens in place, and with a modifier in another tab. A screenshot is kept when
 * TAKE_SCREENSHOT=true.
 */
type Box = { x: number; y: number; width: number; height: number };
const at = (rest: string) => `/projects/${alpha}/harness/branch/feat%2Falpha/${rest}`;
const widths = [1440, 1379, 1300, 1251, 920, 768, 390];
const bar = (page: Page) => page.getByRole('banner');
const field = (page: Page) =>
	bar(page).getByRole('combobox', { name: 'Search entities', exact: true });
const revision = (page: Page) =>
	['Branch', 'Commit'].map((name) => bar(page).getByRole('combobox', { name, exact: true }));
const found = (page: Page) => page.getByRole('listbox', { name: 'Entities found', exact: true });
const box = async (locator: Locator): Promise<Box> => (await locator.boundingBox())!;
/** Whether two boxes share a pixel, the first with a ring of `ring` pixels around it. */
const meet = (one: Box, two: Box, ring: number) =>
	one.x - ring < two.x + two.width &&
	two.x < one.x + one.width + ring &&
	one.y - ring < two.y + two.height &&
	two.y < one.y + one.height + ring;

/** Opens Alpha at `width`, and answers the widths of the revision fields there without the search. */
async function opened(page: Page, width: number): Promise<number[]> {
	await searchFixture(page);
	await page.setViewportSize({ width, height: 900 });
	await page.goto(at('pages'));
	await expect(page.getByRole('navigation', { name: 'Catalog categories' })).toBeVisible();
	await page.evaluate(() => document.fonts.ready.then(() => undefined));
	const searched = page.getByRole('combobox', {
		name: 'Search entities',
		exact: true,
		includeHidden: true
	});
	const place = bar(page).locator(':scope > *').filter({ has: searched });
	await place.evaluate((element: HTMLElement) => (element.style.display = 'none'));
	const without = await Promise.all(revision(page).map(async (one) => (await box(one)).width));
	await place.evaluate((element: HTMLElement) => (element.style.display = ''));
	return without.map(Math.round);
}
async function fits(page: Page, width: number, without: number[]): Promise<void> {
	const search = await box(field(page));
	const fields = await Promise.all(revision(page).map(box));
	expect(fields.map((one) => meet(search, one, 3))).toEqual([false, false]);
	// The search takes nothing of the room of either revision field.
	expect(fields.map((one) => Math.round(one.width))).toEqual(without);
	expect(search.width).toBeGreaterThanOrEqual(120);
	expect([search.x >= 0, search.x + search.width <= width]).toEqual([true, true]);
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
		width
	);
}
async function remember(page: Page, info: TestInfo, name: string): Promise<void> {
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	const folder = process.env.SEARCH_SHOTS ?? info.outputDir;
	mkdirSync(folder, { recursive: true });
	const file = `${process.env.SCREENSHOT_LABEL ?? 'run'}-${name}.png`;
	await page.screenshot({ path: join(folder, file), fullPage: true, animations: 'disabled' });
}

for (const width of widths) {
	test(`at ${width} pixels the search, closed, focused or open, leaves the revision fields whole`, async ({
		page
	}, info) => {
		const without = await opened(page, width);
		await remember(page, info, `fit-${width}`);
		await fits(page, width, without);
		await field(page).focus();
		await expect(field(page)).toBeFocused();
		await fits(page, width, without);
		await field(page).fill('alpha');
		await expect(found(page).getByRole('option')).toHaveCount(6);
		await fits(page, width, without);
		const list = await box(found(page));
		expect([list.x >= 0, list.x + list.width <= width]).toEqual([true, true]);
		const fields = await Promise.all(revision(page).map(box));
		expect(fields.map((one) => meet(list, one, 0))).toEqual([false, false]);
		await remember(page, info, `fit-open-${width}`);
	});

	test(`at ${width} pixels a result opens in place, and with a modifier in another tab`, async ({
		page
	}) => {
		await opened(page, width);
		await field(page).fill('refund');
		const link = found(page).getByRole('option').first().getByRole('link');
		const [tab] = await Promise.all([
			page.context().waitForEvent('page'),
			link.click({ modifiers: ['ControlOrMeta'] })
		]);
		await tab.waitForLoadState();
		expect(new URL(tab.url()).pathname).toBe(at('services/app.service.refunds'));
		await tab.close();
		await expect(page).toHaveURL(at('pages'));
		// Asked again, as one would after looking at the other tab.
		await field(page).fill('refund');
		await link.click();
		await expect(page).toHaveURL(at('services/app.service.refunds'));
	});
}
