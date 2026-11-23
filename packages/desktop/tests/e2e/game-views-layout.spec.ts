import { expect, test } from '../../../../test/support/browserTest';
import type { Page } from '@playwright/test';

/**
 * a6fdvd U8: Game Views keeps one action row, moves view settings and the live AI video into
 * dialogs, and fits a dialog at a 390px phone width. Rendered behaviour only: no stylesheet text.
 */
const phone = { width: 390, height: 844 };

async function openGame(page: Page) {
	await page.setViewportSize(phone);
	await page.goto('/game');
	await expect(page.getByRole('heading', { name: 'Game Views', exact: true })).toBeVisible();
}

/** Only the document scrolls vertically; a horizontal overflow would show as a wider page. */
async function noHorizontalOverflow(page: Page) {
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
}

test('the header keeps only the muted demo line, with no Demo chip', async ({ page }) => {
	await openGame(page);
	await expect(page.getByText('Demo', { exact: true })).toHaveCount(0);
	await expect(
		page.getByText('Demo: an in-memory example. Nothing here is saved.', { exact: true })
	).toHaveCount(1);
});

test('one action row holds the view picker, sections, New view and the settings icon', async ({
	page
}) => {
	await openGame(page);
	const newView = page.getByRole('button', { name: 'New view', exact: true });
	const settings = page.getByRole('button', { name: 'View settings', exact: true });
	await expect(newView).toBeVisible();
	await expect(settings).toBeVisible();
	await expect(page.getByRole('button', { name: 'New level', exact: true })).toHaveCount(0);
	const [row, icon] = [await newView.boundingBox(), await settings.boundingBox()];
	expect(Math.abs((row?.y ?? 0) - (icon?.y ?? 99))).toBeLessThan(4);
	await noHorizontalOverflow(page);
});

test('view settings are hidden until the dialog opens and the dialog fits at 390px', async ({
	page
}) => {
	await openGame(page);
	await expect(page.getByLabel('View title', { exact: true })).toBeHidden();
	await page.getByRole('button', { name: 'View settings', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'View settings' });
	await expect(dialog).toBeVisible();
	await expect(dialog.getByLabel('View title', { exact: true })).toBeVisible();
	await expect(dialog.getByLabel('Art direction', { exact: true })).toBeVisible();
	await expect(dialog.getByRole('button', { name: 'New level', exact: true })).toHaveCount(0);
	const box = await dialog.boundingBox();
	expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
	expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(phone.width);
	await noHorizontalOverflow(page);
});

test('the preview keeps its movement in one row and says why Garden and Vault are off', async ({
	page
}) => {
	await openGame(page);
	await page.getByRole('button', { name: 'Preview', exact: true }).click();
	const row = ['Move left', 'Move right', 'Reset'].map((name) =>
		page.getByRole('button', { name, exact: true })
	);
	for (const control of row) await expect(control).toBeVisible();
	const tops = await Promise.all(row.map(async (control) => (await control.boundingBox())?.y));
	for (const top of tops) expect(Math.abs((top ?? 0) - (tops[0] ?? 0))).toBeLessThan(4);
	await expect(page.getByText('Garden and Vault open once the door is open.')).toBeVisible();
	await noHorizontalOverflow(page);
});

test('live AI video sits behind a dialog that states the price and the configuration', async ({
	page
}) => {
	await openGame(page);
	await page.getByRole('button', { name: 'Preview', exact: true }).click();
	await expect(page.getByRole('button', { name: /Start AI video/ })).toHaveCount(0);
	await page.getByRole('button', { name: 'Live AI video…', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Live AI video' });
	await expect(dialog).toBeVisible();
	await expect(dialog.getByText('Live AI is not configured for this build.')).toBeVisible();
	await expect(dialog.getByText(/costs at most \$\d+\.\d{2}/)).toBeVisible();
	await expect(dialog.getByRole('button', { name: 'Start AI video', exact: true })).toBeDisabled();
	const box = await dialog.boundingBox();
	expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(phone.width);
});
