import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const evidence = '/tmp/harness-analytics-evidence';
test('analytics dashboard shows task first-try rates and filters', async ({ page }) => {
	await page.goto('/analytics');
	await page.evaluate(async () => {
		await document.fonts.ready;
	});
	if (process.env.TAKE_SCREENSHOT === 'true') {
		await mkdir(evidence, { recursive: true });
		await page.screenshot({
			path: `${evidence}/${process.env.SCREENSHOT_LABEL ?? 'test'}.png`,
			fullPage: true
		});
	}
	await expect(page.getByRole('heading', { name: 'Harness Analytics', exact: true })).toBeVisible();
	await expect(page.getByText('Response first try', { exact: true })).toBeVisible();
	await expect(page.getByText('Clean code first try', { exact: true })).toBeVisible();
	await expect(page.getByRole('link', { name: /reports/i }).first()).toBeVisible();
});
