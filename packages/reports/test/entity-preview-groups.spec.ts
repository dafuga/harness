import { expect, test, type Page } from '../../../test/support/browserTest';
import { capture, fits, open, viewports, ready } from './entityPreviewPage';
import { commits, ids } from './entityUnits';
import { frameId } from './entityPreviewData';
import { configExpression, longConfigValue } from './entityConfigFixtures';
import { reviewServiceFolders } from './entityPreviewFunctions';
import { entityLabels } from '../src/utils/entityLens';

test.setTimeout(90_000);
const configUnits = [
	'reports.component.harness-explorer-table',
	'reports.component.harness-explorer-content'
];

async function inspectConfigValues(page: Page, viewport: string, commit: string): Promise<void> {
	const table = page.getByRole('table', { name: 'Configs', exact: true });
	await capture(page, `groups-config-values-${commit.slice(0, 7)}-${viewport}`, configUnits);
	for (const [name, value] of [
		['schema', configExpression(commit)],
		['archivePath', longConfigValue]
	]) {
		const row = table.getByRole('row').filter({ hasText: `orderSettings.${name}` });
		expect((await row.boundingBox())!.height, 'long values stay compact').toBeLessThan(150);
		const inspect = row.getByRole('button', { name: `View value for orderSettings.${name}` });
		await inspect.click();
		const dialog = page.getByRole('dialog', { name: `orderSettings.${name} · Value`, exact: true });
		await capture(page, `groups-config-${name}-${commit.slice(0, 7)}-${viewport}`, configUnits);
		await expect(dialog).toBeVisible();
		expect(await dialog.locator('pre code').textContent()).toBe(value);
		await expect(dialog.locator('orders')).toHaveCount(0);
		expect(await fits(page)).toBe(true);
		await page.keyboard.press('Escape');
		await expect(dialog).toHaveCount(0);
		await expect(inspect).toBeFocused();
	}
	await expect(table.getByRole('row').filter({ hasText: 'orderSettings.enabled' })).toContainText(
		'false'
	);
	expect(await table.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
}

async function configVariables(page: Page, viewport: string): Promise<void> {
	const table = page.getByRole('table', { name: 'Configs', exact: true });
	await expect(table.getByRole('columnheader'), 'only variable and value columns').toHaveText([
		'Variable',
		'Value'
	]);
	await expect(table.getByRole('row').filter({ hasText: 'orderSettings.pageSize' })).toContainText(
		'25'
	);
	await inspectConfigValues(page, viewport, commits.middle);
	await page.getByRole('searchbox').fill('newest');
	await expect(table.getByRole('row')).toHaveCount(2);
	await page.getByRole('link', { name: 'orderSettings.defaultSort', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'orderSettings', exact: true })).toBeVisible();
	await open(page, { category: 'configs', commit: commits.first }, 'groups');
	await capture(page, `groups-configs-historical-${viewport}`, configUnits);
	await inspectConfigValues(page, viewport, commits.first);
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
			'layouts',
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
				category === 'configs' ? configUnits : ['reports.component.harness-explorer-content']
			);
			await expect(page.getByRole('button', { name: 'Filters', exact: true })).toHaveCount(0);
			await expect(page.getByRole('searchbox')).toBeVisible();
			await expect
				.soft(page.getByRole('heading', { level: 2, name: /^Orders \d+$/ }))
				.toBeVisible();
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

/** Helper source folders stay consistent between catalog and selected-callable breadcrumbs. */
async function helperFolders(page: Page, viewport: string) {
	for (const [commit, title] of [
		[commits.middle, 'Strings'],
		[commits.first, 'Words']
	]) {
		await open(page, { category: 'functions', commit }, 'groups');
		await capture(page, `helper-folder-list-${commit.slice(0, 7)}-${viewport}`);
		await expect
			.soft(
				page.getByRole('heading', { name: new RegExp(`^${title} 1$`), level: 2 }),
				'Helper folder follows callable source'
			)
			.toBeVisible();
		await page.getByRole('link', { name: 'plural(2, "item")', exact: true }).click();
		await capture(page, `helper-folder-detail-${commit.slice(0, 7)}-${viewport}`, [
			'reports.component.harness-entity-frame',
			'reports.component.harness-entity-header',
			'reports.component.harness-entity-sections'
		]);
		await expect(
			page.getByRole('navigation', { name: 'Breadcrumb' }),
			'Helper folder follows callable source'
		).toContainText(title);
		await page.reload();
		await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText(title);
	}
}
