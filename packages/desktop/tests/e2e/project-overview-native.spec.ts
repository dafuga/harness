import { expect as baseExpect, test } from '../../../../test/support/browserTest';
import { captureOverview, fakeOverviewBridge } from './support/projectOverviewNativeFixture';
import { scenarioCapture } from './scenario-capture';
import scenario from '../../../../specification/scenarios/project-overview-desktop.json' with { type: 'json' };
import type { ScenarioManifest } from '../../../../src/core/unitTypes';
import type { OverviewBridge } from './support/projectOverviewNativeFixture.types';

const expect = baseExpect.configure({ timeout: 25_000 });
test.setTimeout(90_000);

const viewports = [
	{ name: 'desktop', width: 1440, height: 900 },
	{ name: 'tablet', width: 920, height: 800 },
	{ name: 'mobile', width: 390, height: 844 }
];

test('the desktop landing reaches the overview, which shows the synthetic states', async ({
	page
}) => {
	await fakeOverviewBridge(page, 'ready');
	await page.goto('/');
	await page.getByRole('link', { name: 'Project Overview', exact: true }).click();
	await expect(page).toHaveURL(/\/projects$/);
	await expect(page.getByText('fixture-needs', { exact: true }).first()).toBeVisible();
	await expect(page.getByText('fixture-done', { exact: true }).first()).toBeVisible();
	await expect(page.getByRole('list', { name: 'Computers' }).getByRole('listitem')).toHaveText([
		'fixture-computer busy',
		'fixture-runner ok',
		'fixture-offline offline'
	]);
});

test('an open item shows its read-only detail within the page', async ({ page }) => {
	await fakeOverviewBridge(page, 'ready');
	await page.goto('/projects');
	await page.getByRole('button', { name: 'Open item', exact: true }).first().click();
	await expect(
		page.getByText('Synthetic question for the owner?', { exact: true }).first()
	).toBeVisible();
	await expect(page).toHaveURL(/\/projects$/);
});

for (const viewport of viewports) {
	test(`the overview fits the ${viewport.name} viewport with its states and captures it`, async ({
		page
	}) => {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		await fakeOverviewBridge(page, 'ready');
		await page.goto('/projects');
		await expect(page.getByText('fixture-blocked', { exact: true }).first()).toBeVisible();
		if (viewport.name === 'mobile') {
			await expect(page.getByRole('button', { name: /^Needs you / })).toHaveCSS(
				'white-space',
				'nowrap'
			);
		}
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
			viewport.width
		);
		await scenarioCapture(page, scenario as ScenarioManifest, {
			state: 'overview',
			name: 'projects',
			note: 'Synthetic tracker projects through the renderer bridge.'
		});
		await captureOverview(page, viewport.name);
	});
}

for (const mode of ['web', 'absent', 'refused'] as OverviewBridge[]) {
	test(`without a local tracker read (${mode}) the page shows no tracker data`, async ({
		page
	}) => {
		await fakeOverviewBridge(page, mode);
		await page.goto('/projects');
		await expect(page).toHaveTitle('Projects · Harness');
		await expect(page.getByText('fixture-needs', { exact: true })).toHaveCount(0);
		await expect(page.getByText('fixture-blocked', { exact: true })).toHaveCount(0);
		await expect(page.getByRole('alert')).toContainText('The tracker could not be reached');
	});
}

test('a page without the desktop bridge offers no overview link', async ({ page }) => {
	await fakeOverviewBridge(page, 'web');
	await page.goto('/');
	await expect(page.getByRole('link', { name: 'Project Overview', exact: true })).toHaveCount(0);
});
