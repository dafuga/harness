import { expect, test } from '../../../test/support/browserTest';
import { capture, open, ready, viewports, where } from './entityPreviewPage';
import { ids } from './entityUnits';

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
	await expect(contract.getByRole('table', { name: 'Props', exact: true })).toBeVisible();
	await expect(contract.getByRole('table', { name: 'Inputs', exact: true })).toHaveCount(0);
	await expect(contract.getByRole('table', { name: 'Outputs', exact: true })).toHaveCount(0);
	await expect(contract).toContainText('Orders');
	await expect(contract).toContainText('Search text');

	await open(tab, { ...route, tab: 'states' }, 'states');
	await ready(tab);
	const states = tab.getByRole('tabpanel', { name: 'OrderList states', exact: true });
	await expect(states).toContainText('Default');
	await expect(states).toContainText('Empty');
	expect(await where(tab)).toMatchObject({ ...route, tab: 'states' });
});
