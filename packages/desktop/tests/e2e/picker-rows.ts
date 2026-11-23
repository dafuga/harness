import type { Locator, Page } from '@playwright/test';

/** Opens a revision or project picker from its trigger and returns its popover. */
export async function openRows(page: Page, trigger: string): Promise<Locator> {
	await page.getByRole('button', { name: trigger, exact: true }).click();
	return page.getByRole('dialog', { name: trigger, exact: true });
}

/** Chooses the row of a picker whose text holds `text`, the way a person clicks it. */
export async function chooseRow(page: Page, trigger: string, text: string): Promise<void> {
	const popover = await openRows(page, trigger);
	await popover.locator('.choice-row').filter({ hasText: text }).click();
}

/** Opens a picker and returns its current row; the caller closes it with Escape. */
export async function currentRow(page: Page, trigger: string): Promise<Locator> {
	const popover = await openRows(page, trigger);
	return popover.locator('.choice-row[aria-pressed="true"]');
}
