import { expect, test } from '../../../../test/support/browserTest';
import { fakeProject } from './ui-workspace-fixture';

const commitHash = 'b'.repeat(40);

/** Opens the named picker from the workspace bar of the fixture project. */
async function openPicker(page: import('@playwright/test').Page, name: string) {
	await page.goto('/');
	await page.getByRole('button', { name: 'Open project', exact: true }).click();
	await page.getByRole('button', { name, exact: true }).click();
	const dialog = page.getByRole('dialog', { name, exact: true });
	await expect(dialog).toBeVisible();
	return dialog;
}

test('commit picker is a list of rows, never a native list box', async ({ page }) => {
	await fakeProject(page);
	const dialog = await openPicker(page, 'Choose commit');
	await expect(dialog.locator('select')).toHaveCount(0);
	const rows = dialog.locator('.choice-row');
	await expect(rows).toHaveCount(2);
	for (const row of await rows.all()) {
		expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(44);
	}
	await expect(rows.first()).toBeFocused();
	await expect(rows.first()).toContainText('Fixture');
	await expect(rows.first()).toHaveAttribute('aria-pressed', 'true');
	await expect(rows.nth(1)).toHaveAttribute('aria-pressed', 'false');
});

test('arrow keys move between rows and Enter chooses the commit', async ({ page }) => {
	await fakeProject(page);
	const dialog = await openPicker(page, 'Choose commit');
	await page.keyboard.press('ArrowDown');
	await expect(dialog.locator('.choice-row').nth(1)).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(new RegExp(`commit/${commitHash}`));
});

test('Escape closes the commit picker and returns focus to its trigger', async ({ page }) => {
	await fakeProject(page);
	const dialog = await openPicker(page, 'Choose commit');
	await page.keyboard.press('Escape');
	await expect(dialog).not.toBeVisible();
	await expect(page.getByRole('button', { name: 'Choose commit', exact: true })).toBeFocused();
});

test('branch and workbench pickers hold no native list box', async ({ page }) => {
	await fakeProject(page, true);
	for (const name of ['Choose branch', 'Choose workbench']) {
		const dialog = await openPicker(page, name);
		await expect(dialog.locator('select')).toHaveCount(0);
		await expect(dialog.locator('.choice-row').first()).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(dialog).not.toBeVisible();
	}
});

test('commit picker fits a 390px phone with no overflow', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await fakeProject(page);
	const dialog = await openPicker(page, 'Choose commit');
	const box = await dialog.boundingBox();
	expect(box!.x).toBeGreaterThanOrEqual(0);
	expect(box!.x + box!.width).toBeLessThanOrEqual(390);
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
