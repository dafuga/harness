import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { ReportRepository } from '../../src/repositories/ReportRepository';
import { atomicJson } from '../../src/utils/reportFiles';
import { audioFixture } from '../../test/audioFixture';
const root = '/tmp/project-reports-e2e';
async function audioReport() {
	const store = new ReportRepository(root);
	const run = await store.begin({
		project: '/tmp/audio-project',
		title: 'Mixed media regression',
		mode: 'feature',
		environment: 'synthetic transport fixture',
		revision: 'fixture'
	});
	await store.record(run.id, {
		kind: 'evidence',
		data: {
			id: 'image',
			title: 'Existing screenshot',
			category: 'Screenshots',
			path: join(root, 'fixture.png'),
			status: 'passed',
			viewport: '1440px desktop'
		}
	});
	const bytes = audioFixture();
	const file = createHash('sha256').update(bytes).digest('hex') + '.wav';
	await writeFile(join(store.directory(run.id), 'assets', file), bytes);
	const report = await store.get(run.id);
	report.evidence.push({
		id: 'audio',
		title: 'English test sound',
		category: 'Fresh sounds',
		file,
		status: 'failed',
		source: 'Synthetic playback fixture',
		note: 'Playback is independent of classification acceptance.',
		...{ mediaType: 'audio', durationSeconds: 3, mimeType: 'audio/wav', transcript: 'Test tone' }
	});
	await atomicJson(join(store.directory(run.id), 'manifest.json'), report);
	return run.id;
}
async function capture(page: Page, name: string) {
	await page.locator('#evidence-image img').scrollIntoViewIfNeeded();
	await page.evaluate(async () => {
		await document.fonts.ready;
		const image = document.querySelector<HTMLImageElement>('#evidence-image img');
		if (image) {
			await image.decode();
			if (!image.complete || !image.naturalWidth || !image.naturalHeight)
				throw new Error('Screenshot fixture was not rendered');
		}
	});
	await page.locator('.gallery-section').scrollIntoViewIfNeeded();
	await snapshot(page, name);
}
async function snapshot(page: Page, name: string) {
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	const directory = 'output/evidence/' + (process.env.SCREENSHOT_LABEL || 'current');
	await mkdir(directory, { recursive: true });
	await page.screenshot({ path: join(directory, name + '.png') });
}
for (const width of [1440, 920, 390]) {
	test(`mixed media plays, seeks and downloads original audio at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 1000 });
		await page.goto('/reports/' + (await audioReport()));
		await page.locator('.gallery-section').scrollIntoViewIfNeeded();
		await capture(page, `audio-gallery-${width}`);
		await expect(page.locator('#evidence-audio .audio-transcript')).toBeVisible();
		const audio = page.locator('#evidence-audio audio');
		await expect(audio).toBeVisible();
		await expect(page.locator('#evidence-audio')).toContainText('Failed');
		await audio.evaluate(async (element: HTMLAudioElement) => {
			await element.play();
		});
		await expect
			.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime))
			.toBeGreaterThan(0);
		await audio.evaluate((element: HTMLAudioElement) => {
			element.pause();
			element.currentTime = 1.5;
		});
		await expect
			.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime))
			.toBeCloseTo(1.5, 1);
		await page.getByRole('button', { name: /^Audio/ }).click();
		await expect(page.locator('.evidence-card')).toHaveCount(1);
		await page.locator('#evidence-audio').scrollIntoViewIfNeeded();
		await snapshot(page, `audio-player-${width}`);
		const download = page.waitForEvent('download');
		await page.getByRole('link', { name: 'Download audio' }).click();
		const downloaded = await download;
		expect(await readFile((await downloaded.path())!)).toEqual(audioFixture());
		await page
			.getByRole('group', { name: 'Media type' })
			.getByRole('button', { name: /^Screenshots/ })
			.click();
		await expect(page.locator('audio')).toHaveCount(0);
		await page.getByRole('button', { name: 'Open Existing screenshot' }).click();
		await expect(page.getByRole('button', { name: 'Actual size' })).toBeVisible();
		await page.keyboard.press('Escape');
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
	});
}

test('a browser playback failure keeps the original download and reports not-proven playback', async ({
	page
}) => {
	const source = '**/api/reports/*/assets/*.wav';
	await page.route(source, (route) =>
		route.fulfill({ status: 404, body: 'Unavailable in this browser test' })
	);
	await page.goto('/reports/' + (await audioReport()));
	await page.getByText('Add audio', { exact: true }).click();
	await expect(page.getByRole('button', { name: 'Upload audio' })).toBeEnabled();
	const audio = page.locator('#evidence-audio audio');
	const failedRequest = page.waitForResponse((response) => response.url().endsWith('.wav'));
	await audio.evaluate(async (element: HTMLAudioElement) => {
		await element.play().catch(() => {});
	});
	expect((await failedRequest).status()).toBe(404);
	await expect(page.locator('#evidence-audio')).toContainText('Audio unavailable');
	await expect(page.locator('#evidence-audio')).toContainText('Not proven');
	await expect(
		page.locator('#evidence-audio').getByRole('link', { name: 'Download audio' })
	).toBeVisible();
	await page.unroute(source);
	const download = page.waitForEvent('download');
	await page.locator('#evidence-audio').getByRole('link', { name: 'Download audio' }).click();
	const original = await download;
	expect(await readFile((await original.path())!)).toEqual(audioFixture());
});
