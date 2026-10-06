import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const run = process.env.REPLAY_FIXTURE_RUN;
test.skip(!run, 'Set REPLAY_FIXTURE_RUN to an isolated registered-screenshot report');
test('a live report exposes replay controls and retains playback preferences', async ({ page }) => {
	await page.goto('/reports/' + run);
	await page.evaluate(async () => {
		await document.fonts.ready;
	});
	if (process.env.TAKE_SCREENSHOT === 'true') {
		const directory = '/tmp/project-reports-replay';
		await mkdir(directory, { recursive: true });
		await writeFile(
			`${directory}/${process.env.SCREENSHOT_LABEL || 'current'}-replay-e2e.png`,
			await page.screenshot()
		);
	}
	await expect(page.getByRole('heading', { name: 'Gameplay replay', exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Play replay', exact: true })).toBeVisible();
	await expect(page.getByLabel('Playback speed', { exact: true })).toBeVisible();
	await expect(page.getByLabel('Replay timeline', { exact: true })).toBeVisible();
	await expect(page.getByLabel('Playback speed', { exact: true })).toHaveValue('1');
	await expect(page.getByLabel('Jump to scene', { exact: true })).toHaveValue('1');
	await page.getByLabel('Playback speed', { exact: true }).selectOption('16');
	await page.getByRole('button', { name: 'Play replay', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Pause replay', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Pause replay', exact: true }).click();
	await expect(page.getByLabel('Playback speed', { exact: true })).toHaveValue('16');
	await expect(page.getByRole('button', { name: 'Play replay', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Full screen', exact: true }).click();
	await expect(page.locator('.replay-player')).toHaveClass(/\bfull\b/);
	await page.getByRole('button', { name: 'Exit full screen', exact: true }).click();
	await expect(page.locator('.replay-player')).not.toHaveClass(/\bfull\b/);
});
