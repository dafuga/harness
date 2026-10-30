import { expect, type Page } from '@playwright/test';

/** A long count label remains one word at every catalog viewport. */
export async function assertActivityCountFits(page: Page) {
	const count = page
		.locator('[data-preview-unit="reports.component.project-activity"]')
		.getByTestId('agents-working');
	await expect(count).toHaveText('Unknown');
	await expect(count).toBeVisible();
	const lines = await count.evaluate((node) => {
		const range = document.createRange();
		range.selectNodeContents(node);
		return [...range.getClientRects()].filter((rect) => rect.width > 0).length;
	});
	expect(lines, 'The activity count must stay on one line').toBe(1);
}
