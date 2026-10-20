import { expect, test, type Locator, type Page } from '../../../../test/support/browserTest';
import { atlas, hostedFixture } from './hosted-fixture';

/**
 * The search in the bar of the hosted workspace, beside its account area, at every supported
 * width. Closed, focused or with its results open, the field and its focus ring meet neither
 * revision field nor anything of the account, all of which stay on the screen, and no page is
 * wider than the screen. A result opens in place.
 */
type Box = { x: number; y: number; width: number; height: number };
const pages = `/projects/${atlas}/harness/branch/main/pages`;
const widths = [1440, 1379, 1300, 1251, 920, 768, 390];
const bar = (page: Page) => page.getByRole('banner');
const field = (page: Page) =>
	bar(page).getByRole('combobox', { name: 'Search entities', exact: true });
const found = (page: Page) => page.getByRole('listbox', { name: 'Entities found', exact: true });
const controls = (page: Page): Locator[] => [
	bar(page).getByRole('button', { name: 'Choose branch', exact: true }),
	bar(page).getByRole('button', { name: 'Choose commit', exact: true }),
	bar(page).getByText('Ada Example', { exact: true }),
	bar(page).getByRole('link', { name: 'Projects', exact: true }),
	bar(page).getByRole('link', { name: 'Members', exact: true }),
	bar(page).getByRole('button', { name: 'Sign out', exact: true })
];
const box = async (locator: Locator): Promise<Box> => (await locator.boundingBox())!;
/** Whether two boxes share a pixel, the first with a focus ring of three pixels around it. */
const meet = (one: Box, two: Box) =>
	one.x - 3 < two.x + two.width &&
	two.x < one.x + one.width + 3 &&
	one.y - 3 < two.y + two.height &&
	two.y < one.y + one.height + 3;

async function apart(page: Page, width: number): Promise<void> {
	const search = await box(field(page));
	const placed = await Promise.all(controls(page).map(box));
	expect(placed.map((one) => meet(search, one))).toEqual(placed.map(() => false));
	const shown = (one: Box) => one.x >= 0 && one.x + one.width <= width;
	expect([search, ...placed].map(shown)).toEqual([search, ...placed].map(() => true));
	expect(search.width).toBeGreaterThanOrEqual(120);
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
		width
	);
}

for (const width of widths) {
	test(`at ${width} pixels the search, the revision fields and the account fit the bar apart`, async ({
		page
	}) => {
		await hostedFixture(page);
		await page.setViewportSize({ width, height: 900 });
		await page.goto(`/projects/${atlas}/harness/pages`);
		await expect(page).toHaveURL(new RegExp(`${pages}$`));
		await expect(page.getByRole('navigation', { name: 'Catalog categories' })).toBeVisible();
		await apart(page, width);
		await field(page).focus();
		await expect(field(page)).toBeFocused();
		await apart(page, width);
		await field(page).fill('atlas');
		await expect(found(page).getByRole('option')).toHaveText([/Page.*Atlas activity/]);
		const list = await box(found(page));
		expect([list.x >= 0, list.x + list.width <= width]).toEqual([true, true]);
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
			width
		);
		await found(page).getByRole('option').first().getByRole('link').click();
		await expect(page).toHaveURL(new RegExp(`${pages}/page.activity$`));
	});
}
