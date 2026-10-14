import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { sha, shellBranch, shellMount } from './support/shellData';
import {
	buildShellFixture,
	openShellPage,
	removeShellFixture,
	shellOrigin
} from './support/shellFixture';

/**
 * The search of the explorer bar while its host changes the revision under it: a host that still
 * hands over what it read before is never believed for the new revision, a modified click opens
 * another tab, and a long name stays inside a phone. A screenshot is kept when TAKE_SCREENSHOT=true.
 */
const scoped = `${shellMount}/branch/feature%2Fshell%231`;
const field = (page: Page) =>
	page.getByRole('banner').getByRole('combobox', { name: 'Search entities', exact: true });
const found = (page: Page) => page.getByRole('listbox', { name: 'Entities found', exact: true });
const options = (page: Page) => found(page).getByRole('option');
const long =
	'Reconciliation schedule for overnight settlement batches across every regional ledger and currency';
let home = '';

test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['navbar']);
});
test.afterAll(() => removeShellFixture(home));

async function opened(page: Page, info: TestInfo, name: string, hooks: object) {
	await page.addInitScript((given) => Object.assign(globalThis, given), hooks);
	await openShellPage(page, home, 'navbar');
	await expect(page.getByText('Harness', { exact: true }).first()).toBeVisible();
	await remember(page, info, `ready-${name}`);
}
async function remember(page: Page, info: TestInfo, name: string): Promise<void> {
	await page.evaluate(() => document.fonts.ready.then(() => undefined));
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	const folder = process.env.SEARCH_SHOTS ?? info.outputDir;
	mkdirSync(folder, { recursive: true });
	const file = `${process.env.SCREENSHOT_LABEL ?? 'run'}-${name}.png`;
	await page.screenshot({ path: join(folder, file), fullPage: true, animations: 'disabled' });
}

test('while the host still holds the tip, a selected commit offers none of its results', async ({
	page
}, info) => {
	await page.setViewportSize({ width: 1440, height: 1000 });
	await opened(page, info, 'shell-search-commit-change', { __searchLag: 900 });
	await field(page).fill('order');
	await expect(options(page)).toHaveCount(6);
	await page.evaluate(
		(to) => {
			history.pushState(to, '', '');
			dispatchEvent(new PopStateEvent('popstate'));
		},
		{ branch: shellBranch, commit: sha(3), category: 'functions' }
	);
	await expect(options(page)).toHaveCount(0);
	await expect(page.getByText('Loading entities…').first()).toBeVisible();
	await remember(page, info, 'shell-search-commit-loading');
	await expect(options(page)).toHaveText([
		/Page.*Orders/,
		/Component.*Order list/,
		/Config.*Order limits/,
		/Service.*Order refunds/,
		/Function.*Legacy totals/
	]);
	await field(page).press('Escape');
	await expect(found(page)).toBeHidden();
	await expect(page.getByRole('banner')).toBeVisible();
});

test('a result opened with a modifier is its own address in another tab', async ({
	page
}, info) => {
	await page.setViewportSize({ width: 1440, height: 1000 });
	await opened(page, info, 'shell-search-new-tab', {});
	await field(page).fill('limits');
	// The other tab is answered by the context: the fixture's own route belongs to this page.
	await page
		.context()
		.route(`${shellOrigin}/**`, (route) => route.fulfill({ body: 'Another tab' }));
	const link = options(page).first().getByRole('link');
	await expect(link).toHaveAttribute('href', `${scoped}/configs/app.config.order-limits`);
	const [tab] = await Promise.all([
		page.context().waitForEvent('page'),
		link.click({ modifiers: ['ControlOrMeta'] })
	]);
	await tab.waitForLoadState('domcontentloaded');
	expect(new URL(tab.url()).pathname).toBe(`${scoped}/configs/app.config.order-limits`);
	await expect(page.getByRole('status', { name: 'Address' })).toHaveText(`${scoped}/pages`);
});

test('a long name wraps inside the results on a phone, which stay inside the screen', async ({
	page
}, info) => {
	await page.setViewportSize({ width: 390, height: 844 });
	const extra = [
		{ id: 'app.config.reconciliation', category: 'configs', name: long, purpose: long }
	];
	await opened(page, info, 'shell-search-long-mobile', { __searchExtra: extra });
	await field(page).fill('reconciliation');
	await expect(options(page)).toHaveText([new RegExp(`Config.*${long}`)]);
	await remember(page, info, 'shell-search-long-mobile');
	const box = await found(page).boundingBox();
	expect(box && box.x >= 0 && box.x + box.width <= 390).toBe(true);
	expect(await found(page).evaluate((list) => list.scrollWidth <= list.clientWidth)).toBe(true);
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
