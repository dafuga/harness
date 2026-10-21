import { expect, test, type Page } from '../../../../test/support/browserTest';
import { at, checkpoint, expectNoOverflow, explorer } from './support/explorer';
import { viewports } from './support/harnessCapture';
import { seeded } from './support/harnessHistory';

/**
 * A config and a service in the seeded history are shown with the things around them as every
 * entity is: under Used In and Uses, at every width. What uses a config is listed once, never a
 * second time under another name.
 */
const { commits } = seeded();
const { explorerUnits: units } = explorer();
const main = (rest: string) => at('main', commits.approved, rest);
const content = (page: Page) => page.locator('.ex-content');
const card = (page: Page, name: string) => content(page).getByRole('region', { name, exact: true });
const heading = (page: Page, name: string) => page.getByRole('heading', { level: 1, name });
const named = ['Overview', 'Contract', 'Used In', 'Uses', 'Tests', 'History', 'Source'];

for (const viewport of viewports)
	test(`a config lists what uses it once, under Used In, at ${viewport.id} width`, async ({
		page
	}) => {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		await page.goto(main(`configs/${units.config}`));
		await expect(heading(page, 'Titles config')).toBeVisible();
		await checkpoint(page, `kinds-config-overview-${viewport.id}`);
		for (const name of ['Contract', 'Used In', 'Uses'])
			await expect(card(page, name)).toHaveCount(0);
		await expect(content(page).getByText('Used by', { exact: true })).toHaveCount(0);
		await expectNoOverflow(page);
		await page.getByRole('tab', { name: 'Contract', exact: true }).click();
		await expect(card(page, 'Contract').getByRole('heading', { name: /^Provides/ })).toBeVisible();
		await checkpoint(page, `kinds-config-contract-${viewport.id}`);
		await expectNoOverflow(page);
		await page.getByRole('tab', { name: 'Used In' }).click();
		await expect(card(page, 'Used In').getByRole('link').first()).toBeVisible();
		await checkpoint(page, `kinds-config-used-in-${viewport.id}`);
		await expect(card(page, 'Uses')).toHaveCount(0);
		await expect(card(page, 'Used In')).not.toContainText('src/');
		await expectNoOverflow(page);
	});

test('a service keeps its contract and both usage directions in dedicated tabs', async ({
	page
}) => {
	await page.goto(main('services/service.clock'));
	await expect(heading(page, 'Clock service')).toBeVisible();
	await checkpoint(page, 'kinds-service-overview');
	const tabs = page.getByRole('tablist', { name: 'Clock service sections' }).getByRole('tab');
	await expect(tabs).toHaveText(named);
	for (const name of ['Contract', 'Used In', 'Uses']) await expect(card(page, name)).toHaveCount(0);
	await page.getByRole('tab', { name: 'Contract', exact: true }).click();
	await expect(card(page, 'Contract').getByRole('heading', { name: /^Inputs/ })).toBeVisible();
	await expect(card(page, 'Contract').getByRole('heading', { name: /^Outputs/ })).toBeVisible();
	await page.getByRole('tab', { name: 'Uses', exact: true }).click();
	await expect(card(page, 'Uses')).toBeVisible();
	await expect(card(page, 'Used In')).toHaveCount(0);
	await expect(content(page).getByText(/relationship|used by/i)).toHaveCount(0);
});
