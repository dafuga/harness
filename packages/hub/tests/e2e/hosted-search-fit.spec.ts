import type { Box } from './hosted-search-fit.spec.types';
import {
	expect,
	test,
	type Locator,
	type Page,
	type TestInfo
} from '../../../../test/support/browserTest';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { atlas, hostedFixture } from './hosted-fixture';
const pages = `/projects/${atlas}/harness/branch/main/pages`;
const widths = [1440, 1379, 1300, 1251, 920, 768, 390];
const bar = (page: Page) => page.getByRole('banner', { includeHidden: true });
const trigger = (page: Page) =>
	bar(page).getByRole('button', { name: 'Search entities', exact: true, includeHidden: true });
const field = (page: Page) =>
	page
		.getByRole('dialog', { name: 'Search project' })
		.getByRole('combobox', { name: 'Search entities', exact: true });
const found = (page: Page) => page.getByRole('listbox', { name: 'Entities found', exact: true });
const controls = (page: Page): Locator[] => [
	bar(page).getByRole('button', { name: 'Choose branch', exact: true, includeHidden: true }),
	bar(page).getByRole('button', { name: 'Choose commit', exact: true, includeHidden: true }),
	bar(page).getByText('Ada Example', { exact: true }),
	bar(page).getByRole('link', { name: 'Projects', exact: true, includeHidden: true }),
	bar(page).getByRole('link', { name: 'Members', exact: true, includeHidden: true }),
	bar(page).getByRole('button', { name: 'Sign out', exact: true, includeHidden: true })
];
const box = async (locator: Locator): Promise<Box> => (await locator.boundingBox())!;
/** Whether two boxes share a pixel, the first with a focus ring of three pixels around it. */
const meet = (one: Box, two: Box) =>
	one.x - 3 < two.x + two.width &&
	two.x < one.x + one.width + 3 &&
	one.y - 3 < two.y + two.height &&
	two.y < one.y + one.height + 3;

async function apart(page: Page, width: number): Promise<void> {
	const search = await box(trigger(page));
	const placed = await Promise.all(controls(page).map(box));
	expect(
		placed.map((one) => meet(search, one)),
		'Search and account controls must leave room for focus rings'
	).toEqual(placed.map(() => false));
	const shown = (one: Box) => one.x >= 0 && one.x + one.width <= width;
	expect([search, ...placed].map(shown)).toEqual([search, ...placed].map(() => true));
	expect(search.width).toBeGreaterThanOrEqual(32);
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
		width
	);
}

async function remember(page: Page, info: TestInfo, width: number, suffix = '') {
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all([...document.images].map((image) => image.decode()));
	});
	await page.mouse.move(0, 0);
	const directory = process.env.SEARCH_SHOTS ?? info.outputDir;
	mkdirSync(directory, { recursive: true });
	await page.screenshot({
		path: join(directory, `hosted-search-${width}${suffix}.png`),
		fullPage: true
	});
}

for (const width of widths) {
	test(`at ${width} pixels the search, the revision fields and the account fit the bar apart`, async ({
		page
	}, info) => {
		await hostedFixture(page);
		await page.setViewportSize({ width, height: 900 });
		await page.goto(`/projects/${atlas}/harness/pages`);
		await expect(page).toHaveURL(new RegExp(`${pages}$`));
		await expect(page.getByRole('navigation', { name: 'Catalog categories' })).toBeVisible();
		await remember(page, info, width, '-closed');
		await apart(page, width);
		await trigger(page).focus();
		await expect(trigger(page)).toBeFocused();
		await apart(page, width);
		await trigger(page).click();
		await expect(field(page)).toBeFocused();
		const input = await box(field(page));
		expect(input.width).toBeGreaterThanOrEqual(120);
		expect([input.x >= 0, input.x + input.width <= width]).toEqual([true, true]);
		await field(page).fill('atlas');
		await expect(found(page).getByRole('option')).toHaveText([/Page.*Atlas activity/]);
		const list = await box(found(page));
		await remember(page, info, width);
		expect([list.x >= 0, list.x + list.width <= width]).toEqual([true, true]);
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
			width
		);
		await found(page).getByRole('option').first().getByRole('link').click();
		await expect(page).toHaveURL(new RegExp(`${pages}/page.activity$`));
	});
}
