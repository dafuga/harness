import {
	expect,
	test,
	type Locator,
	type Page,
	type TestInfo
} from '../../../../test/support/browserTest';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { box } from './support/shellChecks';
import { shellMount, shellCategories } from './support/shellData';
import { evidenceRequested } from '../../../../src/utils/record-capture/recordCapture';
import {
	buildShellFixture,
	captureShell,
	openShellPage,
	removeShellFixture,
	shellOrigin
} from './support/shellFixture';

/** The compact trigger stays right of navigation, independently of revision controls. */
const scoped = `${shellMount}/branch/feature%2Fshell%231`;
const widths = [1440, 1379, 1300, 1251, 1024, 920, 834, 768, 685, 390];
const bar = (page: Page) => page.getByRole('banner');
const trigger = (page: Page) =>
	bar(page).getByRole('button', { name: 'Search entities', exact: true });
const field = (page: Page) =>
	page
		.getByRole('dialog', { name: 'Search project' })
		.getByRole('combobox', { name: 'Search entities', exact: true });
const found = (page: Page) => page.getByRole('listbox', { name: 'Entities found', exact: true });
let home = '';

test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['navbar']);
});
test.afterAll(() => removeShellFixture(home));

async function opened(page: Page, width: number): Promise<void> {
	await page.setViewportSize({ width, height: 1000 });
	await openShellPage(page, home, 'navbar');
	await expect(trigger(page)).toBeVisible();
	await page.evaluate(() => document.fonts.ready.then(() => undefined));
	const destinations = bar(page).getByRole('navigation', { name: 'Harness categories' });
	await expect(destinations.locator('a, button')).toHaveText(shellCategories);
}
async function fits(page: Page, width: number): Promise<void> {
	const search = await box(trigger(page));
	expect(search.width).toBeGreaterThanOrEqual(40);
	expect(search.width).toBeLessThanOrEqual(48);
	expect(search.x + search.width).toBeGreaterThan(width - 60);
	expect(search.x + search.width).toBeLessThanOrEqual(width);
	if (width < 1420) {
		const revision = await box(bar(page).locator('.hx-revision'));
		expect(search.y + search.height, 'search stays above the branch divider').toBeLessThanOrEqual(
			revision.y
		);
	}
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
		width
	);
}
async function remember(page: Page, info: TestInfo, name: string): Promise<void> {
	if (!evidenceRequested()) return;
	const width = page.viewportSize()!.width;
	await captureShell(page, home, {
		state: name,
		viewport: width >= 1200 ? 'desktop' : width <= 480 ? 'mobile' : 'tablet',
		slot: 'reports.component.harness-harness-navbar'
	});
	const folder = process.env.SEARCH_SHOTS ?? info.outputDir;
	mkdirSync(folder, { recursive: true });
	const file = `${process.env.SCREENSHOT_LABEL ?? 'run'}-${name}.png`;
	await page.screenshot({ path: join(folder, file), fullPage: true, animations: 'disabled' });
}

for (const width of widths) {
	test(`at ${width} pixels the search, closed, focused or open, leaves the revision controls whole`, async ({
		page
	}, info) => {
		await opened(page, width);
		await remember(page, info, `shell-fit-${width}`);
		await fits(page, width);
		await trigger(page).click();
		await expect(field(page)).toBeFocused();
		await field(page).fill('order');
		await expect(found(page).getByRole('option')).toHaveCount(6);
		await fits(page, width);
		const list = await box(found(page));
		expect([list.x >= 0, list.x + list.width <= width]).toEqual([true, true]);

		await remember(page, info, `shell-fit-open-${width}`);
	});

	test(`at ${width} pixels a result opens in place, and with a modifier in another tab`, async ({
		page
	}) => {
		const refunds = `${scoped}/services/app.service.order-refunds`;
		// The other tab is answered with an empty page: only its address is asked of it.
		await page.context().route(`${shellOrigin}/**`, (route) => route.fulfill({ body: '' }));
		await opened(page, width);
		await trigger(page).click();
		await field(page).fill('refunds');
		const link = found(page).getByRole('option').first().getByRole('link');
		const [tab] = await Promise.all([
			page.context().waitForEvent('page'),
			link.click({ modifiers: ['ControlOrMeta'] })
		]);
		await tab.waitForLoadState();
		expect(new URL(tab.url()).pathname).toBe(refunds);
		await tab.close();
		await expect(page.getByRole('status', { name: 'Address' })).not.toHaveText(refunds);
		// Asked again, as one would after looking at the other tab.
		await field(page).fill('refunds');
		await link.click();
		await expect(page.getByRole('status', { name: 'Address' })).toHaveText(refunds);
	});
}
