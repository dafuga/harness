import { expect, test, type Page, type TestInfo } from '../../../../test/support/browserTest';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { box } from './support/shellChecks';
import { sha, shellBranch, shellMount } from './support/shellData';
import {
	buildShellFixture,
	captureShell,
	openShellPage,
	removeShellFixture
} from './support/shellFixture';

/**
 * The search of the explorer bar over a made-up history: every category of the revision in view,
 * the keyboard, a selected commit that is searched alone, and the widths of a tablet and a phone.
 * Its page is built by this run and answered from its own files; no server is started. A
 * screenshot is kept before the checks of each place when TAKE_SCREENSHOT=true.
 */
const scoped = `${shellMount}/branch/feature%2Fshell%231`;
const field = (page: Page) =>
	page
		.getByRole('dialog', { name: 'Search project' })
		.getByRole('combobox', { name: 'Search entities', exact: true });
const found = (page: Page) => page.getByRole('listbox', { name: 'Entities found', exact: true });
const options = (page: Page) => found(page).getByRole('option');
const address = (page: Page) => page.getByRole('status', { name: 'Address' });
const listed = [
	['Page', 'Orders'],
	['Shell', 'Order frame'],
	['Component', 'Order list'],
	['Helper', 'Order totals'],
	['Config', 'Order limits'],
	['Service', 'Order refunds']
];
let home = '';

test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['navbar']);
});
test.afterAll(() => removeShellFixture(home));

async function opened(page: Page, width: number, height: number) {
	await page.setViewportSize({ width, height });
	await openShellPage(page, home, 'navbar');
	await expect(page.getByText('Harness', { exact: true }).first()).toBeVisible();
	await page.getByRole('button', { name: 'Search entities', exact: true }).click();
}

async function remember(page: Page, info: TestInfo, name: string): Promise<void> {
	await page.evaluate(() => document.fonts.ready.then(() => undefined));
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	const folder = process.env.SEARCH_SHOTS ?? info.outputDir;
	mkdirSync(folder, { recursive: true });
	const file = `${process.env.SCREENSHOT_LABEL ?? 'run'}-${name}.png`;
	await page.screenshot({ path: join(folder, file), fullPage: true, animations: 'disabled' });
}

test('every category of the revision is found, and the keyboard opens a shell under Shells', async ({
	page
}, info) => {
	await opened(page, 1440, 1000);
	await remember(page, info, 'ready-shell-search-results-desktop');
	await field(page).fill('order');
	await expect(options(page)).toHaveCount(6);
	await remember(page, info, 'shell-search-results-desktop');
	for (const [index, [badge, name]] of listed.entries()) {
		await expect(options(page).nth(index)).toContainText(badge);
		await expect(options(page).nth(index)).toContainText(name);
	}
	await expect(options(page).first()).toHaveAttribute('aria-selected', 'true');
	await captureShell(page, home, { state: 'search-results', viewport: 'desktop' });
	await field(page).press('ArrowDown');
	await expect(options(page).nth(1)).toHaveAttribute('aria-selected', 'true');
	await field(page).press('ArrowUp');
	await field(page).press('ArrowDown');
	await field(page).press('Enter');
	await expect(address(page)).toHaveText(`${scoped}/shells/app.shell.order-frame`);
	await expect(found(page)).toBeHidden();
});

test('Escape closes the list then clears the field; nothing found is said; a click opens', async ({
	page
}, info) => {
	await opened(page, 1440, 1000);
	await remember(page, info, 'ready-shell-search-empty-desktop');
	await field(page).fill('zzz');
	await expect(page.getByText('No entity matches “zzz”')).toBeVisible();
	await field(page).fill('cents');
	await expect(options(page)).toHaveText([/Service.*Order refunds/]);
	await field(page).press('Escape');
	await expect(found(page)).toBeHidden();
	await expect(page.getByRole('button', { name: 'Search entities', exact: true })).toBeFocused();
	await page.keyboard.press('ControlOrMeta+k');
	await expect(field(page)).toBeFocused();
	await field(page).fill('limits');
	await options(page).first().click();
	await expect(address(page)).toHaveText(`${scoped}/configs/app.config.order-limits`);
});

test('with a commit selected only that commit is searched, and the result keeps the commit', async ({
	page
}, info) => {
	await opened(page, 1440, 1000);
	await remember(page, info, 'ready-shell-search-pinned-desktop');
	const pinned = { branch: shellBranch, commit: sha(3), category: 'functions' };
	await page.evaluate((to) => history.replaceState(to, ''), pinned);
	await page.reload();
	await page.getByRole('button', { name: 'Search entities', exact: true }).click();
	await expect(field(page)).toHaveAttribute('placeholder', `Search at ${sha(3).slice(0, 7)}`);
	await field(page).fill('frame');
	await remember(page, info, 'shell-search-pinned-desktop');
	await expect(page.getByText('No entity matches “frame”')).toBeVisible();
	await field(page).fill('legacy');
	await field(page).press('Enter');
	await expect(address(page)).toHaveText(
		`${scoped}/commit/${sha(3)}/functions/app.function.legacy-totals`
	);
});

test('at a wide desktop the search shares the one row of the bar, overlapping nothing', async ({
	page
}, info) => {
	await opened(page, 1440, 1000);
	await remember(page, info, 'ready-shell-search-fit-desktop');
	await field(page).press('Escape');
	const trigger = page.getByRole('button', { name: 'Search entities', exact: true });
	const search = await box(trigger);
	expect(search.width).toBeLessThanOrEqual(48);
	expect(search.x + search.width).toBeLessThanOrEqual(1440);
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
});

for (const viewport of [
	{ id: 'tablet', width: 920, height: 800 },
	{ id: 'mobile', width: 390, height: 844 }
]) {
	test(`the search is in the bar at ${viewport.id} width and its results fit the screen`, async ({
		page
	}, info) => {
		await opened(page, viewport.width, viewport.height);
		await remember(page, info, `ready-shell-search-results-${viewport.id}`);
		await expect(field(page)).toBeVisible();
		await field(page).fill('order');
		await expect(options(page)).toHaveCount(6);
		await remember(page, info, `shell-search-results-${viewport.id}`);
		const box = await found(page).boundingBox();
		expect(box && box.x >= 0 && box.x + box.width <= viewport.width).toBe(true);
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
			viewport.width
		);
		await captureShell(page, home, { state: 'search-results', viewport: viewport.id });
	});
}
