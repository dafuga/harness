import { expect, test } from '../../../test/support/browserTest';
import { capture, open, ready, viewports, where } from './entityPreviewPage';
import { commits, ids } from './entityUnits';

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
	test(`page sections show used models instead of a contract at ${viewport} width`, async ({
		page: tab
	}) => {
		await tab.setViewportSize(size);
		for (const commit of [null, commits.middle]) {
			await open(tab, { category: 'pages', entity: ids.page, commit }, 'groups');
			await capture(
				tab,
				`page-models-${process.env.SCREENSHOT_LABEL ?? 'run'}-${viewport}-${commit ? 'commit' : 'tip'}`
			);
			await expect(tab.getByRole('tab', { name: 'Contract', exact: true })).toHaveCount(0);
			await tab.getByRole('tab', { name: 'Models', exact: true }).click();
			const panel = tab.getByRole('tabpanel', { name: 'Orders page models', exact: true });
			await expect(panel).toBeVisible();
			await capture(
				tab,
				`page-models-content-${process.env.SCREENSHOT_LABEL ?? 'run'}-${viewport}-${commit ? 'commit' : 'tip'}`
			);
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
