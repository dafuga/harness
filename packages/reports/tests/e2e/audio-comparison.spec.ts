import { test, expect, type Page } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { audioPairFixture } from '../../test/audioPairFixture';
import { audioFixture } from '../../test/audioFixture';
const root = '/tmp/project-reports-e2e';
async function capture(page: Page, width: number) {
	await page.evaluate(async () => {
		await document.fonts.ready;
	});
	await page.locator('.evidence-grid').scrollIntoViewIfNeeded();
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	const directory = 'output/evidence/' + (process.env.SCREENSHOT_LABEL || 'current');
	await mkdir(directory, { recursive: true });
	await page
		.locator('.evidence-grid')
		.screenshot({ path: join(directory, `audio-comparison-${width}.png`) });
}
for (const width of [1440, 920, 390]) {
	test(`paired audio compares, seeks and downloads both originals at ${width}px`, async ({
		page
	}) => {
		const { run } = await audioPairFixture(root);
		await page.setViewportSize({ width, height: 1100 });
		await page.goto('/reports/' + run.id);
		await page
			.getByRole('group', { name: 'Media type' })
			.getByRole('button', { name: /^Audio/ })
			.click();
		await capture(page, width);
		const opener = page.getByRole('button', {
			name: 'Open audio comparison: Paired recording',
			exact: true
		});
		await opener.click();
		const pair = page.getByRole('dialog');
		await expect(pair).toBeVisible();
		await expect(pair).toHaveCount(1);
		const before = pair.getByRole('group', { name: 'Before recording', exact: true });
		const after = pair.getByRole('group', { name: 'After recording', exact: true });
		await expect(before).toContainText('Failed');
		await expect(after).toContainText('Passed');
		await expect(before).toContainText('Synthetic original microphone');
		await expect(after).toContainText('Synthetic later microphone');
		expect(
			await pair
				.locator('audio')
				.evaluateAll((clips: HTMLAudioElement[]) => clips.every((clip) => clip.paused))
		).toBe(true);
		await before.locator('audio').evaluate(async (clip: HTMLAudioElement) => {
			await clip.play();
			clip.currentTime = 2;
		});
		await expect
			.poll(() => before.locator('audio').evaluate((clip: HTMLAudioElement) => clip.currentTime))
			.toBeGreaterThanOrEqual(2);
		await after.locator('audio').evaluate(async (clip: HTMLAudioElement) => {
			await clip.play();
			clip.currentTime = 3;
		});
		await expect
			.poll(() => before.locator('audio').evaluate((clip: HTMLAudioElement) => clip.paused))
			.toBe(true);
		await expect
			.poll(() => after.locator('audio').evaluate((clip: HTMLAudioElement) => clip.currentTime))
			.toBeGreaterThanOrEqual(3);
		await after.locator('audio').evaluate((clip: HTMLAudioElement) => clip.pause());
		for (const [group, frequency] of [
			[before, 220],
			[after, 440]
		] as const) {
			const download = page.waitForEvent('download');
			await group.getByRole('link', { name: 'Download audio', exact: true }).click();
			const original = await download;
			expect(await readFile((await original.path())!)).toEqual(audioFixture(6, frequency));
		}
		await page.keyboard.press('Escape');
		await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('failed');
		await expect(opener).toBeVisible();
		await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('');
		await page
			.getByRole('textbox', { name: 'Search screenshots, audio and transcripts' })
			.fill('original microphone');
		await expect(opener).toBeVisible();
		await page
			.getByRole('textbox', { name: 'Search screenshots, audio and transcripts' })
			.fill('no match');
		await expect(opener).toHaveCount(0);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
		await expect(page.getByRole('dialog')).toHaveCount(0);
	});
}
test('a missing Before recording leaves a usable After with independent status', async ({
	page
}) => {
	const { store, run } = await audioPairFixture(root);
	await store.mutateActive(run.id, async (report) => {
		report.evidence[0].missing = true;
	});
	await page.goto('/reports/' + run.id);
	await page
		.getByRole('button', {
			name: 'Open audio comparison: Paired recording',
			exact: true
		})
		.click();
	const pair = page.getByRole('dialog');
	await expect(pair.getByRole('group', { name: 'Before recording' })).toContainText(
		'Audio unavailable'
	);
	await expect(pair.getByRole('group', { name: 'Before recording' })).toContainText('Not proven');
	await expect(pair.getByRole('group', { name: 'After recording' }).locator('audio')).toBeVisible();
	await expect(pair.getByRole('group', { name: 'After recording' })).toContainText('Passed');
});
