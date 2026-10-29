import { expect, type Locator, type Page } from '@playwright/test';

/** Permission grants remain legible and reachable at every viewport. */
export async function assertPermissionTable(component: Locator, page: Page, mobile = false) {
	const identifier = component.getByRole('table').first().locator('tbody code').first();
	expect(
		await identifier.evaluate((node) => {
			const range = document.createRange();
			range.selectNodeContents(node);
			return [...range.getClientRects()].filter((box) => box.width > 0).length;
		}),
		'Data identifiers remain unbroken'
	).toBe(1);
	expect(
		await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
		'Permission tables stay inside the document'
	).toBe(true);
	const region = component.getByRole('region', { name: /data access/ }).first();
	if (await region.evaluate((node) => node.scrollWidth > node.clientWidth)) {
		expect(mobile, 'Mobile permission grants retain every field without horizontal scrolling').toBe(
			false
		);
		await region.focus();
		await region.press('ArrowRight');
		await expect.poll(() => region.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
	}
}
