import { expect, test } from '../../../test/support/browserTest';
import { capture, fits, open, ready, viewports, where } from './entityPreviewPage';
import { commits, ids } from './entityUnits';
const modelUnits = [
	'reports.component.explorer-ui-explorer-module-card',
	'reports.component.harness-entity-relations'
];

test('component contracts expose Props and keep verification states on States', async ({
	page: tab
}) => {
	await tab.setViewportSize(viewports.desktop);
	const route = { category: 'components' as const, entity: ids.list };
	await open(tab, { ...route, tab: 'contract' }, 'states');
	await ready(tab);
	const contract = tab.getByRole('tabpanel', { name: 'OrderList contract', exact: true });
	await expect(contract).toBeVisible();
	await expect(contract).not.toContainText(/\bstates?\b/i);
	await capture(tab, 'component-contract-props-no-output-desktop');
	const props = contract.getByRole('table', { name: 'Props', exact: true });
	await expect(props).toBeVisible();
	await expect(props.locator('tbody tr')).toHaveCount(2);
	await expect(contract.getByRole('table', { name: 'Inputs', exact: true })).toHaveCount(0);
	await expect(contract.getByRole('table', { name: 'Outputs', exact: true })).toHaveCount(0);
	await expect(contract.getByRole('table', { name: 'Errors', exact: true })).toHaveCount(0);
	await expect(contract).not.toContainText('No errors declared.');
	await expect(contract).toContainText('Orders');
	await expect(contract).toContainText('Search text');

	await open(tab, { ...route, tab: 'states' }, 'states');
	await ready(tab);
	const states = tab.getByRole('tabpanel', { name: 'OrderList states', exact: true });
	await expect(states).toContainText('Default');
	await expect(states).toContainText('Empty');
	expect(await where(tab)).toMatchObject({ ...route, tab: 'states' });
});

for (const [viewport, size] of Object.entries(viewports)) {
	test(`model detail separates method contracts and table structure at ${viewport} width`, async ({
		page
	}) => {
		await page.setViewportSize(size);
		for (const commit of [null, commits.middle]) {
			await open(
				page,
				{ category: 'models', entity: 'app.model.order', commit, tab: 'contract' },
				'groups'
			);
			await ready(page);
			await capture(page, `model-contract-${commit ? 'commit' : 'tip'}-${viewport}`, [
				'reports.component.entity-contract'
			]);
			for (const method of ['initialize', 'create', 'update'])
				await expect(
					page.getByRole('region', { name: `${method} method`, exact: true })
				).toBeVisible();
			await expect(page.getByRole('table', { name: 'Outputs', exact: true })).toHaveCount(0);
			await expect(page.getByRole('table', { name: 'Errors', exact: true })).toHaveCount(0);
			await page.getByRole('tab', { name: 'Table', exact: true }).click();
			await ready(page);
			await capture(page, `model-table-${commit ? 'commit' : 'tip'}-${viewport}`);
			await expect(
				page.getByRole('heading', { name: commit ? 'purchases' : 'orders', exact: true })
			).toBeVisible();
			await expect(page.getByRole('cell', { name: 'account_id', exact: true })).toBeVisible();
			expect(await where(page)).toMatchObject({
				category: 'models',
				entity: 'app.model.order',
				commit,
				tab: 'table'
			});
			expect(await fits(page)).toBe(true);
			await page.reload();
			await ready(page);
			await expect(page.getByRole('cell', { name: 'account_id', exact: true })).toBeVisible();
		}
	});
	test(`page sections show used models instead of a contract at ${viewport} width`, async ({
		page: tab
	}) => {
		await tab.setViewportSize(size);
		for (const commit of [null, commits.middle]) {
			await open(tab, { category: 'pages', entity: ids.page, commit }, 'groups');
			await capture(
				tab,
				`page-models-${process.env.SCREENSHOT_LABEL ?? 'run'}-${viewport}-${commit ? 'commit' : 'tip'}`,
				['reports.component.harness-entity-overview']
			);
			await expect(tab.getByRole('tab', { name: 'Contract', exact: true })).toHaveCount(0);
			await tab.getByRole('tab', { name: 'Models', exact: true }).click();
			const panel = tab.getByRole('tabpanel', { name: 'Orders page models', exact: true });
			await expect(panel).toBeVisible();
			await capture(
				tab,
				`page-models-content-${process.env.SCREENSHOT_LABEL ?? 'run'}-${viewport}-${commit ? 'commit' : 'tip'}`,
				modelUnits
			);
			const card = panel.getByRole('article', { name: 'Order', exact: true });
			await expect(card).toHaveAttribute(
				'data-harness-component',
				'explorer-ui-explorer-module-card'
			);
			await expect(card.getByRole('group', { name: 'Used In', exact: true })).toBeVisible();
			await expect(panel.getByRole('article')).toHaveCount(1);
			await expect(panel).not.toContainText('Order.types');
			const consumer = card.getByRole('link', { name: 'OrderStore', exact: true });
			await consumer.hover();
			await expect(tab.getByRole('tooltip', { name: 'Preview of OrderStore' })).toBeVisible();
			await tab.keyboard.press('Escape');
			const model = panel.getByRole('link', { name: 'Order', exact: true });
			await expect(model).toBeVisible();
			await model.click();
			expect(await where(tab)).toMatchObject({
				category: 'models',
				entity: 'app.model.order',
				commit
			});
		}
		await open(
			tab,
			{ category: 'pages', entity: ids.page, commit: commits.first, tab: 'models' },
			'groups'
		);
		await expect(
			tab.getByRole('tabpanel', { name: 'Orders page models', exact: true })
		).toContainText('No data models are recorded for this page.');
	});
}
