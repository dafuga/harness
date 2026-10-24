import type { Locator, Page } from '@playwright/test';
import { expect } from '../../../test/support/browserTest';
import { capture, fits, open, where } from './entityPreviewPage';
import { commits, ids } from './entityUnits';

/** Models use helper cards while keeping model and consumer navigation. */
export async function reviewModelCard(page: Page, viewport: string): Promise<void> {
	const appearance = () =>
		page
			.getByRole('article')
			.first()
			.evaluate((node) => {
				const style = getComputedStyle(node);
				const code = getComputedStyle(node.querySelector('code')!);
				const usage = getComputedStyle(node.querySelector('[aria-label="Used In"]')!);
				const grid = getComputedStyle(node.parentElement!);
				return [
					style.backgroundColor,
					style.border,
					style.borderRadius,
					code.font,
					usage.font,
					grid.gap
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
		await expect(page.getByRole('article', { name: 'Invoice', exact: true })).toBeVisible();
		await expect(card.locator('code')).toHaveText('Order');
		await expect(card.locator('h2, p, img, svg, button, .hx-verdict')).toHaveCount(0);
		await expect(page.locator('.ex-legend')).toHaveCount(0);
		expect(await appearance()).toEqual(helperAppearance);
		const usage = card.getByRole('group', { name: 'Used In', exact: true });
		await reviewFlatModelUsage(usage);
		await expect(usage.getByRole('link', { name: 'OrderList', exact: true })).toHaveCount(1);
		await expect(usage.getByRole('link', { name: 'OrderStore', exact: true })).toHaveCount(1);
		await page.getByRole('searchbox', { name: 'Search models' }).fill('absent-model');
		await expect(page.getByRole('article')).toHaveCount(0);
		await page.getByRole('button', { name: 'Show all models', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Filters', exact: true })).toHaveCount(0);
		await expect(card).toHaveCount(1);
		expect(await fits(page)).toBe(true);
		await usage.getByRole('link', { name: 'OrderList', exact: true }).press('Enter');
		expect(await where(page)).toMatchObject({ category: 'components', entity: ids.list, commit });
		await open(page, { category: 'models', commit }, 'helpers');
		await card.getByRole('link', { name: 'Order', exact: true }).press('Enter');
		expect(await where(page)).toMatchObject({
			category: 'models',
			entity: 'app.model.order',
			commit
		});
		await expect(page.getByRole('heading', { level: 1, name: 'Order', exact: true })).toBeVisible();
	}
}

/** Model cards keep their consumers while omitting their module-category headings. */
export async function reviewFlatModelUsage(usage: Locator): Promise<void> {
	await expect(usage.getByRole('list'), 'model consumers use one flat list').toHaveCount(1);
	for (const label of ['Pages', 'Components', 'Services'])
		await expect(
			usage.getByText(label, { exact: true }),
			'model cards omit category headings'
		).toHaveCount(0);
}

/** Shared type modules retain the common card and source declaration detail. */
export async function reviewTypeCard(page: Page, viewport: string): Promise<void> {
	const typeCard = page.getByRole('article', { name: 'OrderInput', exact: true });
	await expect(typeCard).toBeVisible();
	await typeCard.getByRole('link', { name: 'OrderInput', exact: true }).click();
	expect(await where(page)).toMatchObject({
		category: 'types',
		entity: 'app.model.order-input'
	});
	await expect(page.getByRole('heading', { name: 'OrderInput', exact: true })).toBeVisible();
	await expect(page.getByText('Settings it provides', { exact: true })).toHaveCount(0);
	await page.getByRole('tab', { name: 'Contract', exact: true }).click();
	await expect(page.locator('[data-harness-component="entity-contract"]')).toBeVisible();
	await capture(page, `type-definition-${viewport}`, ['reports.component.entity-contract']);
	const definition = page.getByRole('table', { name: 'OrderInput', exact: true });
	await expect(definition).toContainText('id');
	await expect(definition).toContainText('string');
	await expect(page.getByRole('tab', { name: 'Table', exact: true })).toHaveCount(0);
}
