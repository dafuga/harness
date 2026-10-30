import { expect, type Page } from '@playwright/test';

const moved = [301, 302, 303, 307, 308];

/**
 * Proves that an address of the removed report and analytics screens is answered by a redirect
 * into the explorer, and that following it shows the explorer and none of the removed screens.
 */
export async function expectRetired(page: Page, path: string): Promise<void> {
	const answer = await page.request.get(path, { maxRedirects: 0 });
	expect(moved, `${path} answers ${answer.status()}`).toContain(answer.status());
	expect(answer.headers().location).toMatch(/^\/harness(\/|$)/);
	await page.goto(path);
	await expect(page).toHaveURL(/\/harness\/branch\/[^/]+\/(commit\/[0-9a-f]{40}\/)?pages$/);
	await expect(page.getByRole('navigation', { name: 'Harness categories' })).toBeVisible();
	await expect(page.locator('.run-card, .evidence-grid, .upload-form')).toHaveCount(0);
}
