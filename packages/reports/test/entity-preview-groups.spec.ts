import { expect, test, type Page } from '../../../test/support/browserTest';
import { capture, fits, open, viewports, ready } from './entityPreviewPage';
import { commits, ids } from './entityUnits';
import { frameId } from './entityPreviewData';
import { configUnits, inspectConfigValues, inspectConfigCollections } from './entityPreviewConfigs';
import {
	helperFolders,
	reviewPrivateFunctions,
	reviewServiceFolders
} from './entityPreviewFunctions';
import { entityLabels } from '../src/utils/entityLens';

test.setTimeout(90_000);

async function pageFamilies(page: Page): Promise<void> {
	for (const [feature, count] of [
		['Components', 3],
		['Configs', 3],
		['Helpers', 3],
		['Layouts', 3],
		['Models', 3],
		['Pages', 3],
		['Services', 3],
		['Platforms', 2],
		['Styles', 1]
	] as const) {
		await expect
			.soft(
				page.getByRole('heading', { level: 2, name: `${feature} ${count}`, exact: true }),
				'Page families follow their feature folders'
			)
			.toBeVisible({ timeout: 500 });
	}
}

async function configVariables(page: Page, viewport: string): Promise<void> {
	const table = page.getByRole('table', { name: 'orderSettings', exact: true });
	await expect(page.getByRole('table'), 'each source config gets its own table').toHaveCount(2);
	for (const source of ['deliverySettings', 'orderSettings'])
		await expect(
			page.getByRole('heading', { level: 2, name: new RegExp(`^${source} \\d+$`) }),
			'the table heading names its config source rather than the responsibility category'
		).toBeVisible();
	await expect(page.getByRole('table', { name: 'deliverySettings', exact: true })).toContainText(
		'enabled'
	);
	await expect(table).not.toContainText('deliverySettings');
	await expect(table.getByRole('link', { name: 'build.cssCodeSplit', exact: true })).toBeVisible();
	await expect(table.locator('.ex-config-name')).not.toContainText(['orderSettings.']);
	for (const label of [
		'Boolean false',
		'Number 25',
		'String newest',
		'Empty string',
		'Null',
		'Array, 2 items'
	])
		await expect(
			table.getByLabel(label, { exact: true }),
			'config types have distinct accessible presentations'
		).toBeVisible();
	await expect(table.getByRole('columnheader'), 'only variable and value columns').toHaveText([
		'Variable',
		'Value'
	]);
	await expect(table.getByRole('row').filter({ hasText: 'pageSize' })).toContainText('25');
	await inspectConfigValues(page, viewport, commits.middle);
	await inspectConfigCollections(page, viewport);
	await page.getByRole('searchbox').fill('newest');
	await expect(table.getByRole('row')).toHaveCount(2);
	await page.getByRole('searchbox').fill('orderSettings.defaultSort');
	await expect(page.getByRole('table')).toHaveCount(1);
	await expect(table.getByRole('row')).toHaveCount(2);
	await page.getByRole('link', { name: 'defaultSort', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'orderSettings', exact: true })).toBeVisible();
	await open(page, { category: 'configs', commit: commits.first }, 'groups');
	await capture(page, `groups-configs-historical-${viewport}`, configUnits);
	await inspectConfigValues(page, viewport, commits.first);
	await expect(table.getByRole('row').filter({ hasText: 'pageSize' })).toContainText('10');
}

for (const [viewport, size] of Object.entries(viewports)) {
	test(`private dependencies reuse module cards at ${viewport} width`, async ({ page }) => {
		await page.setViewportSize(size);
		await reviewPrivateFunctions(page, viewport);
	});

	test(`category folders group every collection and filter together at ${viewport}`, async ({
		page
	}) => {
		await page.setViewportSize(size);
		for (const category of [
			'pages',
			'layouts',
			'components',
			'functions',
			'configs',
			'services',
			'models',
			'types'
		] as const) {
			await open(page, { category, commit: commits.middle }, 'groups');
			await ready(page);
			await capture(
				page,
				`groups-${category}-${viewport}`,
				category === 'configs' ? configUnits : ['reports.component.harness-explorer-content']
			);
			await expect(page.getByRole('button', { name: 'Filters', exact: true })).toHaveCount(0);
			await expect(page.getByRole('searchbox')).toBeVisible();
			if (category !== 'configs')
				await expect
					.soft(page.getByRole('heading', { level: 2, name: /^Orders \d+$/ }))
					.toBeVisible();
			if (category === 'pages') await pageFamilies(page);
			expect(await fits(page)).toBe(true);
			if (category === 'configs') await configVariables(page, viewport);
			if (category === 'functions') await helperFolders(page, viewport);
		}
		await open(page, { category: 'components', commit: commits.middle }, 'groups');
		await page.getByRole('searchbox').fill('SearchBox');
		await expect(page.getByRole('article')).toHaveCount(1);
		await expect(page.getByRole('article')).toContainText('SearchBox');
		await page.getByRole('searchbox').fill('');
		await expect(page.getByRole('article')).toHaveCount(3);
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
			['functions', ids.filter, 'src/helpers/orders/filterOrders.ts'],
			['configs', ids.settings, 'src/configs/orders/orderSettings.ts'],
			['models', 'app.model.order', 'src/models/orders/Order.ts'],
			['layouts', frameId, 'src/layouts/orders/OrderFrame.svelte'],
			['pages', ids.page, 'src/routes/orders/+page.svelte']
		] as const) {
			await open(
				page,
				{
					category,
					entity,
					commit: commits.middle,
					tab: 'source',
					...(category === 'functions' ? { helper: 'filterOrders' } : {})
				},
				'groups'
			);
			await ready(page);
			await capture(page, `source-${category}-${viewport}`, [
				'reports.component.harness-entity-header'
			]);
			const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
			await expect
				.soft(crumbs.getByRole('listitem'))
				.toHaveText([
					entityLabels[category].title,
					'Orders',
					await page.getByRole('heading', { level: 1 }).innerText()
				]);
			const section = page.locator('section[aria-labelledby="ex-source-title"]');
			await expect
				.soft(section.getByRole('heading', { name: /Symbols|Execution targets/ }))
				.toHaveCount(0, { timeout: 500 });
			await expect
				.soft(section.getByRole('listitem').locator('a, code').first())
				.toHaveText(file, { timeout: 500 });
			expect(await fits(page)).toBe(true);
		}
		await reviewServiceFolders(page, viewport);
	});
}
