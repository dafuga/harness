import { test, expect } from '@playwright/test';
import { ReportRepository } from '../../src/repositories/ReportRepository';
test('upload mode waits for client handlers before accepting a selection', async ({ page }) => {
	const store = new ReportRepository('/tmp/project-reports-e2e');
	const run = await store.begin({
		project: '/tmp/audio-readiness',
		title: 'Audio upload readiness',
		mode: 'feature',
		environment: 'Deliberately delayed client scripts'
	});
	let resume = () => {};
	const ready = new Promise<void>((resolve) => {
		resume = resolve;
	});
	await page.route(/\.js(?:\?|$)/, async (route) => {
		await ready;
		await route.continue();
	});
	try {
		await page.goto('/reports/' + run.id, { waitUntil: 'commit' });
		await page.getByText('Add audio', { exact: true }).click();
		const mode = page.getByRole('combobox', { name: 'Audio upload mode', exact: true });
		await expect(mode).toBeVisible();
		await expect(mode).toBeDisabled();
		resume();
		await expect(mode).toBeEnabled();
		await mode.selectOption('comparison');
		await expect(mode).toHaveValue('comparison');
		await expect(page.getByLabel('Before audio file', { exact: true })).toHaveCount(1);
		await expect(page.getByLabel('After audio file', { exact: true })).toHaveCount(1);
	} finally {
		resume();
	}
});
