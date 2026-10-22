import { expect, test, type Page } from '../../../test/support/browserTest';
import { capture, fits, open, viewports, chooseCatalogFilter, ready } from './entityPreviewPage';
import { commits, ids } from './entityUnits';
import { frameId } from './entityPreviewData';

test.setTimeout(90_000);
const configUnits = ['reports.component.harness-explorer-table', 'reports.function.entity-catalog'];

async function configVariables(page: Page, viewport: string): Promise<void> {
	const table = page.getByRole('table', { name: 'Configs', exact: true });
	await expect(table.getByRole('columnheader'), 'only variable and value columns').toHaveText([
		'Variable',
		'Value'
	]);
	await expect(table.getByRole('row').filter({ hasText: 'orderSettings.pageSize' })).toContainText(
		'25'
	);
	await page.getByRole('searchbox').fill('newest');
	await expect(table.getByRole('row')).toHaveCount(2);
	await page.getByRole('link', { name: 'orderSettings.defaultSort', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'orderSettings', exact: true })).toBeVisible();
	await open(page, { category: 'configs', commit: commits.first }, 'groups');
	await capture(page, `groups-configs-historical-${viewport}`, configUnits);
	await expect(table.getByRole('row').filter({ hasText: 'orderSettings.pageSize' })).toContainText(
		'10'
	);
}

for (const [viewport, size] of Object.entries(viewports)) {
	test(`category folders group every collection and filter together at ${viewport}`, async ({
		page
	}) => {
		await page.setViewportSize(size);
		for (const category of [
			'pages',
			'shells',
			'components',
			'functions',
			'configs',
			'services',
			'models'
		] as const) {
			await open(page, { category, commit: commits.middle }, 'groups');
			await ready(page);
			await capture(
				page,
				`groups-${category}-${viewport}`,
				category === 'configs' ? configUnits : []
			);
			await expect
				.soft(page.getByRole('heading', { level: 2, name: /^Orders \d+$/ }))
				.toBeVisible();
			expect(await fits(page)).toBe(true);
			if (category === 'configs') await configVariables(page, viewport);
		}
		await open(page, { category: 'components', commit: commits.middle }, 'groups');
		await page.getByRole('button', { name: 'Filters', exact: true }).click();
		const dialog = page.getByRole('dialog', { name: 'Filters', exact: true });
		await capture(page, `groups-filter-${viewport}`);
		await expect(dialog.getByRole('group', { name: 'Categories', exact: true })).toBeVisible();
		await dialog.getByRole('checkbox', { name: /^Inputs/ }).check();
		await capture(page, `groups-filter-${viewport}`);
		await dialog.getByRole('button', { name: 'Done', exact: true }).click();
		await expect(page.getByRole('article')).toHaveCount(1);
		await expect(page.getByRole('article')).toContainText('SearchBox');
		await page.getByRole('searchbox').fill('OrderCard');
		await expect(page.getByText('No components match this search.')).toBeVisible();
		await page.getByRole('button', { name: 'Show all components' }).click();
		await expect(page.getByRole('article')).toHaveCount(3);
		await chooseCatalogFilter(page, 'Changed only', true);
		await expect(page.getByRole('article')).toHaveCount(1);
		await open(page, { category: 'services', commit: commits.first }, 'groups');
		await expect(page.getByRole('heading', { level: 2, name: /^Purchases \d+$/ })).toBeVisible();
		await expect(page.getByRole('heading', { level: 2, name: /^Orders \d+$/ })).toHaveCount(0);
	});
}

for (const [viewport, size] of Object.entries(viewports)) {
	test(`source lists category implementation files only at ${viewport}`, async ({ page }) => {
		await page.setViewportSize(size);
		for (const [category, entity, file] of [
			['services', ids.store, 'src/services/orders/OrderStore.ts'],
			['components', ids.list, 'src/components/orders/OrderList.ts'],
			['functions', ids.filter, 'src/functions/orders/filterOrders.ts'],
			['configs', ids.settings, 'src/configs/orders/orderSettings.ts'],
			['models', 'app.model.order', 'src/models/orders/Order.ts'],
			['shells', frameId, 'src/shells/orders/OrderFrame.svelte'],
			['pages', ids.page, 'src/routes/orders/+page.svelte']
		] as const) {
			await open(page, { category, entity, commit: commits.middle, tab: 'source' }, 'groups');
			await page.evaluate(async () => {
				await document.fonts.ready;
				await Promise.all(
					[...document.images]
						.filter((image) => {
							const box = image.getBoundingClientRect();
							return box.width > 0 && box.height > 0 && box.top < innerHeight && box.bottom > 0;
						})
						.map(async (image) => {
							await image.decode();
							if (!image.complete || !image.naturalWidth || !image.naturalHeight)
								throw new Error('Image not ready');
						})
				);
			});
			await capture(page, `source-${category}-${viewport}`);
			const section = page.locator('section[aria-labelledby="ex-source-title"]');
			await expect
				.soft(section.getByRole('heading', { name: /Symbols|Execution targets/ }))
				.toHaveCount(0, { timeout: 500 });
			await expect
				.soft(section.getByRole('listitem').locator('a, code').first())
				.toHaveText(file, { timeout: 500 });
			expect(await fits(page)).toBe(true);
		}
	});
}
