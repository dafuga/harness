import { expect, test, type Locator } from '../../../../test/support/browserTest';
import { agentAt, agentSettingsFixture } from './agent-settings-fixture';

/** a6fdvd U6: rendered behaviour of the catalog Filters dialog at phone width. */

async function box(locator: Locator) {
	await expect(locator).toBeVisible();
	const value = await locator.boundingBox();
	expect(value).not.toBeNull();
	return value!;
}

test('Changed only is a 44px switch row that toggles by clicking its label', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await agentSettingsFixture(page);
	await page.goto(agentAt);
	await page.getByRole('button', { name: 'Filters', exact: true }).click();
	const dialog = page.getByRole('dialog');
	const row = dialog.locator('.checkbox');
	const label = row.getByText('Changed only', { exact: true });
	const control = dialog.getByRole('switch', { name: 'Changed only', exact: true });
	expect((await box(row)).height).toBeGreaterThanOrEqual(44);
	const labelBox = await box(label);
	const controlBox = await box(control);
	expect(labelBox.x).toBeLessThan(controlBox.x);
	expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(controlBox.x);
	await expect(control).not.toBeChecked();
	await label.click();
	await expect(control).toBeChecked();
	await label.click();
	await expect(control).not.toBeChecked();
});
