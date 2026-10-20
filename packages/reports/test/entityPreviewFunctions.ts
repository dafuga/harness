import type { Locator, Page } from '@playwright/test';
import { expect } from '../../../test/support/browserTest';
import { capture, fits, open, where } from './entityPreviewPage';
import { commits, ids } from './entityUnits';

/** Private functions stay reachable from their owner at the tip and a historical commit. */
export async function reviewPrivateFunctions(page: Page, viewport: string): Promise<void> {
	for (const commit of [null, commits.middle]) {
		await open(page, { category: 'components', entity: ids.list, tab: 'uses', commit }, 'helpers');
		await page
			.getByRole('region', { name: 'Uses', exact: true })
			.getByRole('link', { name: 'single', exact: true })
			.click();
		await page.evaluate(async () => {
			await document.fonts.ready;
		});
		await capture(
			page,
			`${process.env.SCREENSHOT_LABEL ?? 'run'}-private-function-${commit ? 'commit' : 'tip'}-${viewport}`
		);
		const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
		await expect(breadcrumb, 'Private functions have no Helpers breadcrumb').not.toContainText(
			'Helpers'
		);
		await expect(breadcrumb.getByRole('link', { name: 'OrderList', exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'single', exact: true })).toBeVisible();
		await page.getByRole('tab', { name: 'Examples', exact: true }).click();
		await expect(page.getByRole('tabpanel', { name: 'single examples' })).toBeVisible();
		await page.getByRole('tab', { name: 'Source', exact: true }).click();
		await expect(page.getByRole('tabpanel', { name: 'single source' })).toBeVisible();
		await page.getByRole('tab', { name: 'History', exact: true }).click();
		await expect(breadcrumb).not.toContainText('Helpers');
		expect(await where(page)).toMatchObject({
			entity: 'function.single',
			commit,
			section: 'history'
		});
		expect(await fits(page)).toBe(true);
	}
}

/** A shared helper card opens the same callable's contract without extra detail panels. */
export async function reviewHelperCard(page: Page, cards: Locator): Promise<void> {
	await expect(cards.first(), 'function cards omit detail panels').not.toContainText(
		/Contract|Inputs|Output|Used by|View tests|Shared|Changed/
	);
	await expect(cards.locator('.hx-verdict')).toHaveCount(0);
	await expect(cards.locator('code'), 'function cards show example calls').toHaveText(
		'filterOrders(orders, "SERVICE")'
	);
	await expect(cards.locator('h2, p, img')).toHaveCount(0);
	await expect(cards.locator('svg'), 'function cards have no arrow').toHaveCount(0);
	const action = cards.getByRole('link', { name: 'filterOrders(orders, "SERVICE")', exact: true });
	await expect(action).toHaveCount(1);
	await action.press('Enter');
	expect(await where(page)).toMatchObject({
		category: 'functions',
		entity: ids.filter,
		commit: null
	});
	await page.getByRole('tab', { name: 'Contract', exact: true }).click();
	await expect(page.getByRole('table', { name: 'Parameters', exact: true })).toBeVisible();
}

/** Consumer links are limited to three eligible units and retain current or selected-commit scope. */
export async function reviewHelperUsage(page: Page, viewport: string): Promise<void> {
	for (const commit of [null, commits.middle]) {
		await open(page, { category: 'functions', commit }, 'helpers');
		await page.evaluate(async () => {
			await document.fonts.ready;
		});
		await capture(page, `helper-used-in-${commit ? 'commit' : 'tip'}-${viewport}`);
		const card = page.getByRole('article');
		const usage = card.getByRole('group', { name: 'Used In', exact: true });
		await expect(usage, 'helper cards expose their consumers').toBeVisible();
		await expect(usage.getByRole('link')).toHaveText(['OrderList', 'OrderStore', 'Order']);
		const sizes = await card.evaluate((node) => [
			parseFloat(getComputedStyle(node.querySelector('code')!).fontSize),
			parseFloat(getComputedStyle(node.querySelector('[aria-label="Used In"]')!).fontSize)
		]);
		expect(sizes[1], 'usage is smaller than the function call').toBeLessThan(sizes[0]);
		expect(await fits(page)).toBe(true);
		for (const [label, category, entity] of [
			['OrderList', 'components', ids.list],
			['OrderStore', 'services', ids.store],
			['Order', 'models', 'app.model.order']
		] as const) {
			await page
				.getByRole('group', { name: 'Used In', exact: true })
				.getByRole('link', { name: label, exact: true })
				.press('Enter');
			expect(await where(page)).toMatchObject({
				branch: 'feature/orders',
				commit,
				category,
				entity
			});
			await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible();
			await open(page, { category: 'functions', commit }, 'helpers');
		}
	}
}

/** Service cards keep only a recorded name and usage, with navigation in the viewed revision. */
export async function reviewServiceCard(page: Page, viewport: string): Promise<void> {
	for (const commit of [null, commits.middle]) {
		await open(page, { category: 'services', commit }, 'helpers');
		await page.evaluate(async () => {
			await document.fonts.ready;
		});
		await capture(page, `service-card-${commit ? 'commit' : 'tip'}-${viewport}`);
		const card = page.getByRole('article', { name: 'OrderStore', exact: true });
		await expect(page.getByRole('article')).toHaveCount(2);
		await expect(card, 'service cards show only name and usage').toHaveText(
			/^\s*OrderStore\s*Used In\s*OrderList\s*SearchBox\s*$/
		);
		await expect(card.locator('h2, p, img, button, svg, .hx-verdict')).toHaveCount(0);
		const usage = card.getByRole('group', { name: 'Used In', exact: true });
		await expect(usage.getByRole('link')).toHaveText(['OrderList', 'SearchBox']);
		for (const search of ['OrderStore', 'Order store']) {
			await page.getByRole('searchbox', { name: 'Search services' }).fill(search);
			await expect(card).toHaveCount(1);
		}
		expect(await fits(page)).toBe(true);
		await card.getByRole('link', { name: 'OrderStore', exact: true }).press('Enter');
		expect(await where(page)).toMatchObject({
			branch: 'feature/orders',
			category: 'services',
			entity: ids.store,
			commit
		});
		await expect(page.getByRole('heading', { name: 'OrderStore', exact: true })).toBeVisible();
		await open(page, { category: 'services', commit }, 'helpers');
		await card
			.getByRole('group', { name: 'Used In', exact: true })
			.getByRole('link', { name: 'OrderList', exact: true })
			.press('Enter');
		expect(await where(page)).toMatchObject({
			branch: 'feature/orders',
			category: 'components',
			entity: ids.list,
			commit
		});
		await reviewFunctionService(page, commit);
	}
}

/** Function services and their class consumers keep one code name on every surface. */
async function reviewFunctionService(page: Page, commit: string | null) {
	await open(page, { category: 'services', commit }, 'helpers');
	const card = page
		.getByRole('article')
		.filter({ has: page.getByRole('link', { name: 'recordAnalytics', exact: true }) });
	await expect(
		card.getByRole('group', { name: 'Used In', exact: true }).getByRole('link')
	).toHaveText(['OrderList', 'OrderStore']);
	await card.getByRole('link', { name: 'recordAnalytics', exact: true }).press('Enter');
	await expect(page.getByRole('heading', { name: 'recordAnalytics', exact: true })).toBeVisible();
	await open(page, { category: 'services', commit }, 'helpers');
	await card.getByRole('link', { name: 'OrderStore', exact: true }).press('Enter');
	await expect(page.getByRole('heading', { name: 'OrderStore', exact: true })).toBeVisible();
	expect(await where(page)).toMatchObject({ commit, entity: ids.store });
}
