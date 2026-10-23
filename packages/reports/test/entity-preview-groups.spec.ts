import { expect, test, type Page } from '../../../test/support/browserTest';
import { capture, fits, open, viewports, ready } from './entityPreviewPage';
import { commits, ids } from './entityUnits';
import { frameId } from './entityPreviewData';
import { configExpression, longConfigValue } from './entityConfigFixtures';
import { helperFolders, reviewServiceFolders } from './entityPreviewFunctions';
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
		expect(
			await inspect.innerText(),
			'value controls have icons without View value text'
		).not.toContain('View value');
		await expect(row.locator('.ex-value-preview')).toHaveCount(0);
		if (name === 'schema') await expect(row).toContainText('5 attributes');
		await inspect.press('Enter');
		const dialog = page.getByRole('dialog', { name: `orderSettings.${name} · Value`, exact: true });
		await capture(page, `groups-config-${name}-${commit.slice(0, 7)}-${viewport}`, configUnits);
		await expect(dialog).toBeVisible();
		if (name === 'schema') {
			await expect(
				dialog.getByRole('region', { name: 'Value contents', exact: true })
			).toContainText('pageSize');
			await expect(dialog).toContainText(
				commit === commits.first ? 'z.literal(10)' : 'z.literal(25)'
			);
			await dialog.getByText('Source expression', { exact: true }).click();
		}
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

async function inspectConfigCollections(page: Page, viewport: string): Promise<void> {
	const table = page.getByRole('table', { name: 'Configs', exact: true });
	const schema = table.getByRole('row').filter({ hasText: 'orderSettings.schema' });
	const steps = table.getByRole('row').filter({ hasText: 'orderSettings.steps' });
	const inspect = steps.getByRole('button', {
		name: 'View value for orderSettings.steps',
		exact: true
	});
	await capture(page, `groups-config-collections-${viewport}`, configUnits);
	await expect(steps).toContainText('2 items');
	await expect(
		table.getByRole('row').filter({ hasText: 'orderSettings.emptySteps' })
	).toContainText('0 items');
	expect(await steps.locator('button svg path').getAttribute('d')).not.toBe(
		await schema.locator('button svg path').getAttribute('d')
	);
	await inspect.press('Enter');
	const dialog = page.getByRole('dialog', { name: 'orderSettings.steps · Value', exact: true });
	const contents = dialog.getByRole('region', { name: 'Value contents', exact: true });
	await contents.locator('summary').filter({ hasText: /^0\b/ }).click();
	await contents
		.locator('summary')
		.filter({ hasText: /^flags\b/ })
		.click();
	await capture(page, `groups-config-collections-expanded-${viewport}`, configUnits);
	await expect(contents).toContainText('Pack');
	await expect(contents).toContainText('true');
	await expect(contents).toContainText('false');
	expect(await fits(page)).toBe(true);
	await page.keyboard.press('Escape');
	await expect(inspect).toBeFocused();
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
	await inspectConfigCollections(page, viewport);
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
