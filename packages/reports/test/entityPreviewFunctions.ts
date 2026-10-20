import type { Locator, Page } from '@playwright/test';
import { expect } from '../../../test/support/browserTest';
import { capture, chooseCatalogFilter, fits, open, where } from './entityPreviewPage';
import { commits, ids } from './entityUnits';

/** Private functions stay reachable from their owner at the tip and a historical commit. */
export async function reviewPrivateFunctions(page: Page, viewport: string): Promise<void> {
	for (const commit of [null, commits.middle]) {
		await open(page, { category: 'components', entity: ids.list, tab: 'uses', commit }, 'helpers');
		await page
			.getByRole('region', { name: 'Uses', exact: true })
			.getByRole('link', { name: 'Single', exact: true })
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
		await expect(breadcrumb.getByRole('link', { name: 'Order list', exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Single', exact: true })).toBeVisible();
		await page.getByRole('tab', { name: 'Examples', exact: true }).click();
		await expect(page.getByRole('tabpanel', { name: 'Single examples' })).toBeVisible();
		await page.getByRole('tab', { name: 'Source', exact: true }).click();
		await expect(page.getByRole('tabpanel', { name: 'Single source' })).toBeVisible();
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
export async function reviewHelperCard(
	page: Page,
	cards: Locator,
	commit: string | null = null
): Promise<void> {
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
	expect(await where(page)).toEqual({
		branch: 'feature/orders',
		category: 'functions',
		entity: ids.filter,
		commit,
		helper: 'filterOrders',
		tab: 'contract'
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
		await expect(usage.getByRole('link')).toHaveText(['Order list', 'Order store', 'Order']);
		const sizes = await card.evaluate((node) => [
			parseFloat(getComputedStyle(node.querySelector('code')!).fontSize),
			parseFloat(getComputedStyle(node.querySelector('[aria-label="Used In"]')!).fontSize)
		]);
		expect(sizes[1], 'usage is smaller than the function call').toBeLessThan(sizes[0]);
		expect(await fits(page)).toBe(true);
		for (const [label, category, entity] of [
			['Order list', 'components', ids.list],
			['Order store', 'services', ids.store],
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

/** Models share helper appearance while their names and consumers keep model navigation. */
export async function reviewModelCard(page: Page, viewport: string): Promise<void> {
	const appearance = () =>
		page
			.getByRole('article')
			.first()
			.evaluate((node) => {
				const style = getComputedStyle(node),
					code = getComputedStyle(node.querySelector('code')!);
				const usage = getComputedStyle(node.querySelector('[aria-label="Used In"]')!);
				const grid = getComputedStyle(node.parentElement!);
				return [
					style.backgroundColor,
					style.border,
					style.borderRadius,
					code.font,
					usage.font,
					grid.gap,
					grid.gridTemplateColumns
				];
			});
	await open(page, { category: 'functions' }, 'helpers');
	const helperAppearance = await appearance();
	for (const commit of [null, commits.middle]) {
		await open(page, { category: 'models', commit }, 'helpers');
		await page.evaluate(async () => {
			await document.fonts.ready;
		});
		await capture(page, `model-card-${commit ? 'commit' : 'tip'}-${viewport}`);
		const card = page.getByRole('article', { name: 'Order', exact: true });
		await expect(card.locator('code')).toHaveText('Order');
		await expect(card.locator('h2, p, img, svg, button, .hx-verdict')).toHaveCount(0);
		await expect(page.locator('.ex-legend')).toHaveCount(0);
		expect(await appearance()).toEqual(helperAppearance);
		const usage = card.getByRole('group', { name: 'Used In', exact: true });
		await expect(usage.getByRole('link')).toHaveText(['Order list', 'Order store']);
		await page.getByRole('searchbox', { name: 'Search models' }).fill('absent-model');
		await expect(page.getByRole('article')).toHaveCount(0);
		await page.getByRole('button', { name: 'Show all models', exact: true }).click();
		await chooseCatalogFilter(page, 'Usage filter', 'shared');
		await expect(card).toHaveCount(1);
		expect(await fits(page)).toBe(true);
		await usage.getByRole('link', { name: 'Order list', exact: true }).press('Enter');
		expect(await where(page)).toMatchObject({ category: 'components', entity: ids.list, commit });
		await open(page, { category: 'models', commit }, 'helpers');
		await card.getByRole('link', { name: 'Order', exact: true }).press('Enter');
		expect(await where(page)).toEqual({
			branch: 'feature/orders',
			category: 'models',
			entity: 'app.model.order',
			commit
		});
		await expect(page.getByRole('heading', { level: 1, name: 'Order', exact: true })).toBeVisible();
	}
}
