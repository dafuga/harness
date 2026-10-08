import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('offers both providers and queues Claude without claiming it is active', async ({ page }) => {
	await page.goto('/preview');
	await page.evaluate(async () => {
		await document.fonts.ready;
	});
	if (process.env.TAKE_SCREENSHOT === 'true') {
		await mkdir('../../.cache/codex-picker-evidence', { recursive: true });
		await page.screenshot({
			path:
				'../../.cache/codex-picker-evidence/' +
				(process.env.SCREENSHOT_LABEL ?? 'checkpoint') +
				'-picker.png',
			fullPage: true
		});
	}
	await expect(page.getByRole('combobox', { name: 'Provider', exact: true })).toBeVisible();
	await page
		.getByRole('combobox', { name: 'Provider', exact: true })
		.selectOption('harness-claude');
	await expect(page.getByRole('combobox', { name: 'Model', exact: true })).toHaveValue(
		'claude-opus-5-5'
	);
	await expect(page.getByRole('combobox', { name: 'Reasoning effort', exact: true })).toHaveValue(
		'xhigh'
	);
	await page.getByRole('button', { name: 'Queue switch', exact: true }).click();
	await expect(page.getByText('Pending', { exact: true })).toBeVisible();
	await expect(page.getByText('Unknown', { exact: true })).toBeVisible();
	await expect(page.getByText('OpenAI', { exact: true }).first()).toBeVisible();
	await page.reload();
	await expect(page.getByText('Pending', { exact: true })).toBeVisible();
	if (process.env.TAKE_SCREENSHOT === 'true')
		await page.screenshot({
			path:
				'../../.cache/codex-picker-evidence/' +
				(process.env.SCREENSHOT_LABEL ?? 'checkpoint') +
				'-pending.png',
			fullPage: true
		});
	await page.getByRole('button', { name: 'Cancel pending switch', exact: true }).click();
	await expect(page.getByText('Cancelled', { exact: true })).toBeVisible();
});
