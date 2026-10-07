import { expect, test, type Page, type Locator } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { audioPairFixture } from '../../test/audioPairFixture';

async function capture(page: Page, region: Locator, name: string) {
	await page.evaluate(async () => {
		await document.fonts.ready;
	});
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	const directory = 'output/evidence/' + (process.env.SCREENSHOT_LABEL || 'current');
	await mkdir(directory, { recursive: true });
	await region.screenshot({ path: join(directory, name + '.png') });
}

test('switching a phase and closing the viewer stop hidden audio without autoplay on reopening', async ({
	page
}) => {
	const { run } = await audioPairFixture('/tmp/project-reports-e2e');
	await page.goto('/reports/' + run.id);
	const opener = page.getByRole('button', {
		name: 'Open audio comparison: Paired recording',
		exact: true
	});
	await opener.click();
	const dialog = page.getByRole('dialog');
	const before = dialog
		.getByRole('group', { name: 'Before recording', exact: true })
		.locator('audio');
	await before.evaluate(async (clip: HTMLAudioElement) => {
		(window as Window & { removedClip?: HTMLAudioElement }).removedClip = clip;
		await clip.play();
	});
	await expect
		.poll(() => before.evaluate((clip: HTMLAudioElement) => clip.currentTime))
		.toBeGreaterThan(0);
	await dialog.getByRole('button', { name: 'View after recording', exact: true }).click();
	await expect
		.poll(() =>
			page.evaluate(
				() => (window as Window & { removedClip?: HTMLAudioElement }).removedClip?.paused
			)
		)
		.toBe(true);
	const after = dialog
		.getByRole('group', { name: 'After recording', exact: true })
		.locator('audio');
	await after.evaluate(async (clip: HTMLAudioElement) => {
		(window as Window & { removedClip?: HTMLAudioElement }).removedClip = clip;
		await clip.play();
	});
	await page.keyboard.press('Escape');
	await expect
		.poll(() =>
			page.evaluate(
				() => (window as Window & { removedClip?: HTMLAudioElement }).removedClip?.paused
			)
		)
		.toBe(true);
	await expect(opener).toBeFocused();
	await opener.click();
	expect(
		await dialog
			.locator('audio')
			.evaluateAll((clips: HTMLAudioElement[]) => clips.every((clip) => clip.paused))
	).toBe(true);
	await expect(page.locator('#evidence-after')).toHaveCount(1);
	await expect(page.locator('#evidence-before')).toHaveCount(1);
});

test('opening pauses gallery audio and the Close button pauses the viewer and restores focus', async ({
	page
}) => {
	const { store, run } = await audioPairFixture('/tmp/project-reports-e2e');
	await store.record(run.id, {
		kind: 'evidence',
		data: {
			id: 'reference',
			title: 'Gallery recording',
			category: 'Audio comparison',
			path: join(store.directory(run.id), 'after.wav'),
			status: 'passed'
		}
	});
	await page.goto('/reports/' + run.id);
	const galleryClip = page.getByLabel('Audio: Gallery recording', { exact: true });
	await galleryClip.evaluate((clip: HTMLAudioElement) => clip.play());
	await expect
		.poll(() => galleryClip.evaluate((clip: HTMLAudioElement) => clip.paused))
		.toBe(false);
	const opener = page.getByRole('button', {
		name: 'Open audio comparison: Paired recording',
		exact: true
	});
	await opener.click();
	await expect.poll(() => galleryClip.evaluate((clip: HTMLAudioElement) => clip.paused)).toBe(true);
	const dialog = page.getByRole('dialog');
	await dialog
		.getByRole('group', { name: 'After recording', exact: true })
		.locator('audio')
		.evaluate(async (clip: HTMLAudioElement) => {
			(window as Window & { removedClip?: HTMLAudioElement }).removedClip = clip;
			await clip.play();
		});
	await dialog.getByRole('button', { name: 'Close viewer', exact: true }).click();
	await expect(dialog).toHaveCount(0);
	expect(
		await page.evaluate(
			() => (window as Window & { removedClip?: HTMLAudioElement }).removedClip?.paused
		)
	).toBe(true);
	await expect(opener).toBeFocused();
});

for (const width of [1440, 920, 390]) {
	test(`one audio card opens both recordings and retains transcripts at ${width}px`, async ({
		page
	}) => {
		const { run } = await audioPairFixture('/tmp/project-reports-e2e');
		await page.setViewportSize({ width, height: 1100 });
		await page.goto('/reports/' + run.id);
		await page
			.getByRole('group', { name: 'Media type' })
			.getByRole('button', { name: /^Audio/ })
			.click();
		const grid = page.locator('.evidence-grid');
		await capture(page, grid, 'audio-comparison-card-' + width);
		const opener = grid.getByRole('button', {
			name: 'Open audio comparison: Paired recording',
			exact: true
		});
		await expect(opener).toBeVisible();
		await expect(grid.locator('article')).toHaveCount(1);
		await expect(grid.locator('audio')).toHaveCount(0);
		await expect(opener).toContainText('Before');
		await expect(opener).toContainText('After');
		await opener.click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();
		await expect(dialog.locator('audio')).toHaveCount(2);
		const before = dialog.getByRole('group', { name: 'Before recording', exact: true });
		const after = dialog.getByRole('group', { name: 'After recording', exact: true });
		await expect(before).toContainText('Failed');
		await expect(after).toContainText('Passed');
		await expect(before.getByText('Low synthetic tone', { exact: true })).toBeVisible();
		await expect(after.getByText('High synthetic tone', { exact: true })).toBeVisible();
		await capture(page, dialog, 'audio-comparison-viewer-' + width);
		await dialog.getByRole('button', { name: 'View before recording', exact: true }).click();
		await expect(dialog.locator('audio')).toHaveCount(1);
		await expect(before).toBeVisible();
		await dialog.getByRole('button', { name: 'View after recording', exact: true }).click();
		await expect(after).toBeVisible();
		await dialog.getByRole('button', { name: 'Compare before and after', exact: true }).click();
		await expect(dialog.locator('audio')).toHaveCount(2);
		await page.keyboard.press('Escape');
		await expect(dialog).toHaveCount(0);
		await expect(opener).toBeFocused();
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
	});
}
